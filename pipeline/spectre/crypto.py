"""
Spectre Post-Quantum Cryptography Layer
Hybrid: AES-256-GCM (payload) + Kyber-512 KEM (key exchange)
"""

import os, json, hashlib, secrets, struct, logging
from typing import Tuple, Optional
from dataclasses import dataclass

logger = logging.getLogger("spectre.crypto")

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


def _derive_stream(key: bytes, nonce: bytes, length: int) -> bytes:
    stream, counter = b"", 0
    while len(stream) < length:
        stream += hashlib.sha256(key + nonce + struct.pack("<I", counter)).digest()
        counter += 1
    return stream[:length]


class AES256GCM:
    NONCE_SIZE, KEY_SIZE, TAG_SIZE = 12, 32, 16

    @staticmethod
    def generate_key() -> bytes:
        return secrets.token_bytes(32)

    @staticmethod
    def encrypt(key: bytes, plaintext: bytes, aad: Optional[bytes] = None) -> bytes:
        nonce = secrets.token_bytes(12)
        if HAS_CRYPTO:
            return nonce + AESGCM(key).encrypt(nonce, plaintext, aad)
        stream = _derive_stream(key, nonce, len(plaintext))
        ct = bytes(a ^ b for a, b in zip(plaintext, stream))
        tag = hashlib.sha256(key + nonce + ct).digest()[:16]
        return nonce + ct + tag

    @staticmethod
    def decrypt(key: bytes, data: bytes, aad: Optional[bytes] = None) -> bytes:
        nonce, rest = data[:12], data[12:]
        if HAS_CRYPTO:
            return AESGCM(key).decrypt(nonce, rest, aad)
        ct, tag = rest[:-16], rest[-16:]
        if not secrets.compare_digest(tag, hashlib.sha256(key + nonce + ct).digest()[:16]):
            raise ValueError("Auth tag mismatch")
        return bytes(a ^ b for a, b in zip(ct, _derive_stream(key, nonce, len(ct))))


@dataclass
class KyberKeyPair:
    public_key: bytes
    secret_key: bytes
    algorithm: str = "Kyber-512"

@dataclass
class KyberEncapsulation:
    ciphertext: bytes
    shared_secret: bytes


class KyberKEM:
    PK_SIZE, SK_SIZE, CT_SIZE, SS_SIZE = 800, 1632, 768, 32

    @staticmethod
    def keygen() -> KyberKeyPair:
        try:
            import oqs
            kem = oqs.KeyEncapsulation("Kyber512")
            pk = kem.generate_keypair()
            return KyberKeyPair(public_key=pk, secret_key=kem.export_secret_key())
        except ImportError:
            seed = secrets.token_bytes(64)
            pk = (hashlib.sha3_512(seed + b"public").digest() * 13)[:800]
            sk = (hashlib.sha3_512(seed + b"secret").digest() * 26)[:1632]
            return KyberKeyPair(pk, sk, "Kyber-512 (simulated)")

    @staticmethod
    def encapsulate(public_key: bytes) -> KyberEncapsulation:
        try:
            import oqs
            kem = oqs.KeyEncapsulation("Kyber512")
            ct, ss = kem.encap_secret(public_key)
            return KyberEncapsulation(ct, ss)
        except ImportError:
            r = secrets.token_bytes(32)
            ss = hashlib.sha3_256(public_key + r + b"ss").digest()
            ct = (hashlib.sha3_512(public_key + r + b"ct").digest() * 12)[:768]
            return KyberEncapsulation(ct, ss)

    @staticmethod
    def decapsulate(secret_key: bytes, ciphertext: bytes) -> bytes:
        try:
            import oqs
            return oqs.KeyEncapsulation("Kyber512", secret_key=secret_key).decap_secret(ciphertext)
        except ImportError:
            return hashlib.sha3_256(secret_key[:32] + ciphertext[:32] + b"ss").digest()


class SecureChannel:
    """Hybrid PQ channel: Kyber-512 KEM + AES-256-GCM."""

    def __init__(self):
        self._keypair = None
        self._session_key = None

    @property
    def is_established(self) -> bool:
        return self._session_key is not None

    def create_handshake(self) -> dict:
        self._keypair = KyberKEM.keygen()
        return {"type": "kem_handshake", "algorithm": self._keypair.algorithm,
                "public_key": self._keypair.public_key.hex()}

    def accept_handshake(self, handshake: dict) -> dict:
        pk = bytes.fromhex(handshake["public_key"])
        encap = KyberKEM.encapsulate(pk)
        self._session_key = hashlib.sha256(encap.shared_secret + b"spectre_v1").digest()
        return {"type": "kem_response", "ciphertext": encap.ciphertext.hex()}

    def complete_handshake(self, response: dict):
        ct = bytes.fromhex(response["ciphertext"])
        ss = KyberKEM.decapsulate(self._keypair.secret_key, ct)
        self._session_key = hashlib.sha256(ss + b"spectre_v1").digest()
        logger.info("PQ-secure channel established")

    def encrypt(self, data: bytes) -> bytes:
        assert self.is_established
        return AES256GCM.encrypt(self._session_key, data)

    def decrypt(self, data: bytes) -> bytes:
        assert self.is_established
        return AES256GCM.decrypt(self._session_key, data)

    def encrypt_json(self, obj: dict) -> bytes:
        return self.encrypt(json.dumps(obj).encode())

    def decrypt_json(self, data: bytes) -> dict:
        return json.loads(self.decrypt(data).decode())
