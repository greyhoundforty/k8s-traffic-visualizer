#!/usr/bin/env bash
set -euo pipefail

# Kubernetes Traffic Visualizer startup script

# Configuration
PYTHON_CMD="python3"
VENV_DIR=".venv"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
DEMO_MANIFEST="deploy/demo-app.yaml"
PORT=5000

# Parse command line arguments
INSTALL_DEPS=false
INSTALL_DEMO=false
USE_DEMO=false

print_usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --help           Show this help message"
  echo "  --install-deps   Install dependencies"
  echo "  --install-demo   Install demo application in Kubernetes"
  echo "  --use-demo       Use demo namespace (k8s-traffic-demo)"
  echo ""
}

for arg in "$@"; do
  case $arg in
    --help)
      print_usage
      exit 0
      ;;
    --install-deps)
      INSTALL_DEPS=true
      ;;
    --install-demo)
      INSTALL_DEMO=true
      ;;
    --use-demo)
      USE_DEMO=true
      ;;
    *)
      echo "Unknown option: $arg"
      print_usage
      exit 1
      ;;
  esac
done

# Check for required tools
check_dependencies() {
  echo "Checking dependencies..."
  
  # Check for Python
  if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "Error: Python not found. Please install Python 3.9 or higher."
    exit 1
  fi
  
  # Check Python version
  PYTHON_VERSION=$($PYTHON_CMD --version | cut -d ' ' -f 2)
  if [[ $(echo "$PYTHON_VERSION" | cut -d '.' -f 1,2 | sed 's/\.//') -lt 39 ]]; then
    echo "Error: Python 3.9 or higher required, found $PYTHON_VERSION"
    exit 1
  fi
  
  # Check for kubectl if installing demo
  if [ "$INSTALL_DEMO" = true ]; then
    if ! command -v kubectl &> /dev/null; then
      echo "Error: kubectl not found. Please install kubectl to deploy the demo application."
      exit 1
    fi
  fi
  
  echo "All dependencies satisfied."
}

# Install Python dependencies
install_dependencies() {
  echo "Installing dependencies..."
  
  # Create virtual environment if it doesn't exist
  if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv $VENV_DIR
  fi
  
  # Activate virtual environment
  source "$VENV_DIR/bin/activate" || {
    echo "Error: Failed to activate virtual environment."
    exit 1
  }
  
  # Install backend dependencies
  echo "Installing backend dependencies..."
  pip install -r "$BACKEND_DIR/requirements.txt"
  
  echo "Dependencies installed successfully."
}

# Install demo application in Kubernetes
install_demo() {
  echo "Installing demo application in Kubernetes..."
  
  # Check if namespace exists
  if kubectl get namespace k8s-traffic-demo &> /dev/null; then
    echo "Namespace k8s-traffic-demo already exists. Updating resources..."
  else
    echo "Creating namespace k8s-traffic-demo..."
  fi
  
  # Apply demo manifests
  kubectl apply -f "$DEMO_MANIFEST"
  
  echo "Demo application installed successfully."
}

# Start the application
start_application() {
  echo "Starting Kubernetes Traffic Visualizer..."
  
  # Activate virtual environment
  source "$VENV_DIR/bin/activate" || {
    echo "Error: Failed to activate virtual environment."
    exit 1
  }
  
  # Set environment variables
  export FLASK_APP="$BACKEND_DIR/app.py"
  export FLASK_ENV="development"
  
  if [ "$USE_DEMO" = true ]; then
    export DEFAULT_NAMESPACE="k8s-traffic-demo"
    echo "Using demo namespace: k8s-traffic-demo"
  fi
  
  # Run the application
  cd "$BACKEND_DIR"
  echo "Server starting at http://localhost:$PORT"
  $PYTHON_CMD app.py
}

# Main execution
check_dependencies

if [ "$INSTALL_DEPS" = true ]; then
  install_dependencies
fi

if [ "$INSTALL_DEMO" = true ]; then
  install_demo
fi

start_application