# Kubernetes Traffic Visualizer

## Project Overview

The Kubernetes Traffic Visualizer is a web-based tool that provides a real-time visual representation of resources and traffic flows within a Kubernetes cluster. It helps DevOps engineers and developers understand the relationships between different resources and monitor traffic patterns.

### Key (planned) Features

- [x] Real-time visualization of Kubernetes resources (pods, services, deployments, ingresses)
- Interactive graph with force-directed layout
- Live traffic flow animation
- Detailed resource information on demand
- Multi-namespace support
- [x] WebSocket-based real-time updates

## Prerequisites

Before you begin, ensure you have the following installed:

- **Backend:**
  - Python 3.10 or higher
  - pip (Python package manager)
  - Access to a Kubernetes cluster (local or remote)
  - kubectl configured with access to your cluster

- **Frontend:**
  - Node.js 18 or higher
  - npm (Node package manager)

## Installation and Running

There are two ways to set up and run the application:

### Option 1: Quick Start (Using run.sh)

This method automatically handles all dependencies and startup processes:

```bash
# Clone the repository
git clone https://github.com/greyhoundforty/k8s-traffic-visualizer.git

# Navigate to the project directory
cd k8s-traffic-visualizer

# Run the setup and start script
./run.sh
```

The application will be available at `http://localhost:5050`

### Option 2: Manual Setup

Follow these steps if you need more control over the setup process or if the run.sh script does not work for you:

#### Backend Setup

```shell
# Clone the repository
git clone https://github.com/yourusername/k8s-traffic-visualizer.git

# Navigate to the project directory
cd k8s-traffic-visualizer

# Create and activate a virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the required Python packages
pip install -r requirements.txt
```

#### Frontend Setup

Before we start the python server, we need to build the frontend files:

```bash
# Navigate to the frontend directory
cd ../frontend

# Install frontend dependencies
npm install

# Build the frontend
npm run build
```

#### Start the Backend Server

```bash
# Navigate to the backend directory 
cd ../backend
# Start the backend server
python app.py
```

### Troubleshooting

Adding these here as I hit all of them while creating and setting up the project.

**WebSocket Connection Issues**

If you see "Disconnected" in the UI, ensure the backend is running with host set to 0.0.0.0:

```python
pythonsocketio.run(app, host='0.0.0.0', port=port, debug=True)
```

**Check for any firewall or proxy settings that might block WebSocket connections**

Visit `http://localhost:5050/websocket-test` to test WebSocket connectivity directly.

**Frontend File Loading Issues**

If you encounter 404 errors for frontend files, make sure you've built the frontend:

```shell
cd frontend
npm run build
```

