# ═══════════════════════════════════════════════════════════════════════════
# Spectre — Top-Level Makefile
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: all engine pipeline client clean help

# ─── Default ────────────────────────────────────────────────────────────────

all: engine pipeline client
	@echo ""
	@echo "  ███████╗██████╗ ███████╗ ██████╗████████╗██████╗ ███████╗"
	@echo "  ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝"
	@echo "  ███████╗██████╔╝█████╗  ██║        ██║   ██████╔╝█████╗  "
	@echo "  ╚════██║██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██╗██╔══╝  "
	@echo "  ███████║██║     ███████╗╚██████╗   ██║   ██║  ██║███████╗"
	@echo "  ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝"
	@echo ""
	@echo "  Build complete. Run 'make run' to start."

# ─── C++ Engine ─────────────────────────────────────────────────────────────

engine:
	@echo "▸ Building C++ engine with -O3 optimization..."
	mkdir -p engine/build
	cd engine/build && cmake .. -DCMAKE_BUILD_TYPE=Release && make -j$$(nproc)
	@echo "  ✓ Engine compiled"

# ─── Python Pipeline ───────────────────────────────────────────────────────

pipeline:
	@echo "▸ Installing Python dependencies..."
	cd pipeline && pip install -r requirements.txt -q
	@echo "  ✓ Pipeline ready"

# ─── Next.js Client ────────────────────────────────────────────────────────

client:
	@echo "▸ Installing client dependencies..."
	cd client && npm install
	@echo "  ✓ Client ready"

# ─── Run ────────────────────────────────────────────────────────────────────

run-pipeline:
	@echo "▸ Starting Spectre pipeline..."
	cd pipeline && python main.py

run-client:
	@echo "▸ Starting dashboard..."
	cd client && npm run dev

run:
	@echo "▸ Starting Spectre (pipeline + client)..."
	@make run-pipeline &
	@sleep 2
	@make run-client

# ─── Docker ─────────────────────────────────────────────────────────────────

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

# ─── Clean ──────────────────────────────────────────────────────────────────

clean:
	rm -rf engine/build
	rm -rf client/.next client/node_modules
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@echo "  ✓ Cleaned"

# ─── Help ───────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Spectre — Available targets:"
	@echo ""
	@echo "    make all          Build everything (engine + pipeline + client)"
	@echo "    make engine       Build C++ analysis engine"
	@echo "    make pipeline     Install Python pipeline dependencies"
	@echo "    make client       Install Next.js client dependencies"
	@echo "    make run          Start both pipeline and client"
	@echo "    make run-pipeline Start pipeline server only"
	@echo "    make run-client   Start Next.js dev server only"
	@echo "    make docker-up    Start with Docker Compose"
	@echo "    make clean        Remove build artifacts"
	@echo ""
