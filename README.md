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

## Installation

### Clone the Repository

```bash
git clone https://github.com/yourusername/k8s-traffic-visualizer.git
cd k8s-traffic-visualizer
```

#### Backend Setup

1. Create and activate a virtual environment:

```bash 
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```


2. Install required python packages

```shell
pip install -r requirements.txt
```

#### Frontend Setup

1. Install node dependencies


```shell
cd ../frontend
npm install 
```

### Development Mode

1. Running the Backend

```shell
python backend/app.py
```

The backend server will start on `http://localhost:5050` by default.
