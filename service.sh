#!/bin/bash

# Clawmander Service Management Script
# Manages systemd user services for backend and frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"
BACKEND_SERVICE="clawmander-backend.service"
FRONTEND_SERVICE="clawmander-frontend.service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_service_files() {
    if [[ ! -f "$SCRIPT_DIR/$BACKEND_SERVICE" ]]; then
        print_error "Backend service file not found: $SCRIPT_DIR/$BACKEND_SERVICE"
        exit 1
    fi
    if [[ ! -f "$SCRIPT_DIR/$FRONTEND_SERVICE" ]]; then
        print_error "Frontend service file not found: $SCRIPT_DIR/$FRONTEND_SERVICE"
        exit 1
    fi
}

build_project() {
    print_info "Installing dependencies and building project..."

    # Backend dependencies
    print_info "Installing backend dependencies..."
    (cd "$SCRIPT_DIR/backend" && npm install --production)
    print_success "Backend dependencies installed"

    # Frontend dependencies and build
    print_info "Installing frontend dependencies..."
    (cd "$SCRIPT_DIR/frontend" && npm install)
    print_info "Building frontend..."
    (cd "$SCRIPT_DIR/frontend" && npm run build)
    print_success "Frontend built successfully"
}

install_services() {
    print_info "Installing Clawmander systemd services..."

    check_service_files

    # Build everything first
    build_project

    # Create systemd user directory if it doesn't exist
    mkdir -p "$SERVICE_DIR"

    # Copy service files
    print_info "Copying service files to $SERVICE_DIR"
    cp "$SCRIPT_DIR/$BACKEND_SERVICE" "$SERVICE_DIR/"
    cp "$SCRIPT_DIR/$FRONTEND_SERVICE" "$SERVICE_DIR/"

    # Reload systemd daemon
    print_info "Reloading systemd daemon..."
    systemctl --user daemon-reload

    # Enable services
    print_info "Enabling services..."
    systemctl --user enable "$BACKEND_SERVICE"
    systemctl --user enable "$FRONTEND_SERVICE"

    print_success "Services installed and enabled"
    print_info "Backend service: $BACKEND_SERVICE"
    print_info "Frontend service: $FRONTEND_SERVICE"
    print_info ""
    print_info "To start services now, run: $0 start"
    print_info "To enable lingering (start on boot), run: loginctl enable-linger $USER"
}

uninstall_services() {
    print_info "Uninstalling Clawmander systemd services..."

    # Stop services if running
    print_info "Stopping services..."
    systemctl --user stop "$FRONTEND_SERVICE" 2>/dev/null || true
    systemctl --user stop "$BACKEND_SERVICE" 2>/dev/null || true
    kill_stale_processes

    # Disable services
    print_info "Disabling services..."
    systemctl --user disable "$BACKEND_SERVICE" 2>/dev/null || true
    systemctl --user disable "$FRONTEND_SERVICE" 2>/dev/null || true

    # Remove service files
    print_info "Removing service files..."
    rm -f "$SERVICE_DIR/$BACKEND_SERVICE"
    rm -f "$SERVICE_DIR/$FRONTEND_SERVICE"

    # Reload systemd daemon
    systemctl --user daemon-reload

    print_success "Services uninstalled"
}

start_services() {
    print_info "Starting Clawmander services..."
    systemctl --user start "$BACKEND_SERVICE"
    systemctl --user start "$FRONTEND_SERVICE"
    print_success "Services started"
    echo ""
    status_services
}

kill_stale_processes() {
    # Kill any orphaned node processes from previous runs that systemd didn't clean up
    local killed=0
    for pattern in "node.*clawmander.*server" "next.*clawmander" "node.*clawmander/frontend" "node.*clawmander/backend"; do
        if pgrep -f "$pattern" > /dev/null 2>&1; then
            pkill -f "$pattern" 2>/dev/null && killed=$((killed + 1))
        fi
    done
    # Also free the ports in case zombie processes are holding them
    for port in 3001 3000; do
        if fuser "$port/tcp" > /dev/null 2>&1; then
            fuser -k "$port/tcp" > /dev/null 2>&1 && killed=$((killed + 1))
            print_info "Freed port $port"
        fi
    done
    if [[ $killed -gt 0 ]]; then
        print_info "Killed $killed stale process/port(s)"
        sleep 1
    fi
}

stop_services() {
    print_info "Stopping Clawmander services..."
    systemctl --user stop "$FRONTEND_SERVICE" 2>/dev/null || true
    systemctl --user stop "$BACKEND_SERVICE" 2>/dev/null || true
    kill_stale_processes
    print_success "Services stopped"
}

restart_services() {
    print_info "Restarting Clawmander services..."
    systemctl --user stop "$FRONTEND_SERVICE" 2>/dev/null || true
    systemctl --user stop "$BACKEND_SERVICE" 2>/dev/null || true
    kill_stale_processes
    systemctl --user start "$BACKEND_SERVICE"
    systemctl --user start "$FRONTEND_SERVICE"
    print_success "Services restarted"
    echo ""
    status_services
}

status_services() {
    print_info "Service Status:"
    echo ""
    echo "=== Backend ==="
    systemctl --user status "$BACKEND_SERVICE" --no-pager || true
    echo ""
    echo "=== Frontend ==="
    systemctl --user status "$FRONTEND_SERVICE" --no-pager || true
}

logs_services() {
    local service="${1:-both}"

    if [[ "$service" == "backend" ]]; then
        print_info "Showing backend logs (Ctrl+C to exit)..."
        journalctl --user -u "$BACKEND_SERVICE" -f
    elif [[ "$service" == "frontend" ]]; then
        print_info "Showing frontend logs (Ctrl+C to exit)..."
        journalctl --user -u "$FRONTEND_SERVICE" -f
    else
        print_info "Showing all logs (Ctrl+C to exit)..."
        journalctl --user -u "$BACKEND_SERVICE" -u "$FRONTEND_SERVICE" -f
    fi
}

enable_boot() {
    print_info "Enabling boot-time startup..."
    loginctl enable-linger "$USER"
    print_success "Boot-time startup enabled for user $USER"
    print_info "Services will now start automatically when the system boots"
}

disable_boot() {
    print_info "Disabling boot-time startup..."
    loginctl disable-linger "$USER"
    print_success "Boot-time startup disabled for user $USER"
}

show_usage() {
    cat << EOF
Clawmander Service Management Script

Usage: $0 <command> [options]

Commands:
    build           Install dependencies and build frontend
    install         Build project, then install and enable systemd services
    uninstall       Stop, disable, and remove systemd services
    start           Start both backend and frontend services
    stop            Stop both services and kill stale processes
    kill            Kill all stale Clawmander node processes
    restart         Restart both services (kills stale processes first)
    status          Show status of both services
    logs [service]  Show logs (options: backend, frontend, or both)
    enable-boot     Enable services to start on system boot
    disable-boot    Disable boot-time startup

Examples:
    $0 build                # Build project only
    $0 install              # Build + install services
    $0 start                # Start services
    $0 logs backend         # Show backend logs only
    $0 logs                 # Show all logs
    $0 enable-boot          # Auto-start on boot

Service Files:
    Backend:  $BACKEND_SERVICE
    Frontend: $FRONTEND_SERVICE
    Location: $SERVICE_DIR

URLs (when running):
    Backend:  http://localhost:3001
    Frontend: http://localhost:3000
EOF
}

# Main
case "${1:-}" in
    build)
        build_project
        ;;
    install)
        install_services
        ;;
    uninstall)
        uninstall_services
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    kill)
        print_info "Killing stale Clawmander processes..."
        kill_stale_processes
        print_success "Done"
        ;;
    restart)
        restart_services
        ;;
    status)
        status_services
        ;;
    logs)
        logs_services "${2:-both}"
        ;;
    enable-boot)
        enable_boot
        ;;
    disable-boot)
        disable_boot
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo ""
        show_usage
        exit 1
        ;;
esac
