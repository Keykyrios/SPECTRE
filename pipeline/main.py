"""
Spectre — Main Entry Point
Launch the real-time intelligence pipeline and WebSocket server.
"""

import asyncio
import logging
import uvicorn

from spectre.config import SpectreConfig
from spectre.ws_server import app

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-20s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S"
)

logger = logging.getLogger("spectre")


def main():
    config = SpectreConfig()

    banner = """
    ███████╗██████╗ ███████╗ ██████╗████████╗██████╗ ███████╗
    ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝
    ███████╗██████╔╝█████╗  ██║        ██║   ██████╔╝█████╗
    ╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██╗██╔══╝
    ███████║██║     ███████╗╚██████╗   ██║   ██║  ██║███████╗
    ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝
     Real-Time Post-Quantum Financial Intelligence Engine v1.0
    """
    print(banner)
    logger.info(f"Chain: {config.chain.upper()}")
    logger.info(f"Mode: {'DEMO' if config.demo_mode else 'LIVE'}")
    logger.info(f"Server: {config.api_host}:{config.api_port}")
    logger.info(f"PQ Crypto: {'ENABLED' if config.pq_enabled else 'DISABLED'}")

    uvicorn.run(
        app,
        host=config.api_host,
        port=config.api_port,
        log_level="info",
        ws_ping_interval=20,
        ws_ping_timeout=30,
    )


if __name__ == "__main__":
    main()
