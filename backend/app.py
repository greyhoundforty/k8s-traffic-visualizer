#!/usr/bin/env python3
"""
Main application for the Kubernetes Traffic Visualizer backend.
This serves as the entry point for the Flask application and WebSocket server.
"""

import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from icecream import ic

# Configure icecream
ic.configureOutput(prefix='🍦 ')

# Import Kubernetes client modules
from k8s_client.cluster import KubernetesClient
from models.resources import build_topology, get_traffic_flow_paths
from api.routes import register_api_routes




# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend/dist')
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Socket.IO for real-time updates
# Adding more debugging information as the UI shows disconnected
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# Initialize Kubernetes client
k8s_client = KubernetesClient()

# Register API routes
register_api_routes(app, k8s_client)

# Serve frontend files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    ic("Serving frontend path:", path)
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Debug routes for Kubernetes connection testing
@app.route('/api/test-k8s-connection')
def test_k8s_connection():
    try:
        # Test connection by listing namespaces
        namespaces = k8s_client.list_namespaces()
        ic("Connection test - namespaces:", namespaces)
        
        # Get version info
        version = k8s_client.core_v1.get_api_resources()
        ic("API Version:", version.group_version)
        
        return jsonify({
            'success': True, 
            'message': 'Successfully connected to Kubernetes API',
            'namespaces': namespaces,
            'api_version': version.group_version
        })
    except Exception as e:
        ic("Connection test failed:", str(e))
        return jsonify({
            'success': False,
            'message': f'Failed to connect to Kubernetes API: {str(e)}'
        })

@app.route('/api/debug/namespaces')
def debug_namespaces():
    namespaces = k8s_client.list_namespaces()
    ic("Debug - namespaces:", namespaces)
    return jsonify({'namespaces': namespaces})

@app.route('/api/debug/resources/<namespace>')
def debug_resources(namespace):
    resources = k8s_client.get_resources(namespace)
    counts = {
        'pods': len(resources['pods']),
        'services': len(resources['services']),
        'deployments': len(resources['deployments']),
        'ingresses': len(resources['ingresses'])
    }
    ic("Debug - resource counts:", counts)
    return jsonify({'resource_counts': counts})

@app.route('/api/namespaces')
def api_namespaces():
    namespaces = k8s_client.list_namespaces()
    ic("API - namespaces:", namespaces)
    return jsonify({'namespaces': namespaces})

# WebSocket event handlers
# adding icecream debug info
@socketio.on('connect')
def handle_connect():
    ic("WebSocket client connected")
    ic("WebSocket transport:", request.environ.get('HTTP_UPGRADE_INSECURE_REQUESTS'))
    ic("WebSocket client IP:", request.remote_addr)
    logger.info('Client connected')
    # Send initial topology data
    topology = build_topology(k8s_client)
    ic("Emitting topology with nodes:", len(topology.get('nodes', [])))
    ic("Emitting topology with namespaces:", topology.get('namespaces', []))
    emit('topology', topology)

@socketio.on('disconnect')
def handle_disconnect():
    ic("WebSocket client disconnected")
    logger.info('Client disconnected')

# WebSocket event for requesting resource details
@socketio.on('get_resource_details')
def handle_get_resource_details(data):
    resource_type = data.get('resource_type')
    resource_name = data.get('resource_name')
    namespace = data.get('namespace', 'default')
    
    ic(f"Getting details for {resource_type}/{resource_name} in {namespace}")
    logger.info(f'Getting details for {resource_type}/{resource_name} in {namespace}')
    
    details = k8s_client.get_resource_details(
        resource_type=resource_type,
        resource_name=resource_name,
        namespace=namespace
    )
    
    emit('resource_details', details)

# Add this function to handle namespace change events
@socketio.on('change_namespace')
def handle_change_namespace(data):
    namespace = data.get('namespace', 'default')
    ic("Changing namespace to:", namespace)
    
    # Get topology for the selected namespace
    topology = build_topology(k8s_client, namespace)
    ic("Emitting topology for namespace:", namespace)
    
    # Update nodes and connections for the new namespace
    emit('topology', topology)

# Start traffic simulation
def start_traffic_simulation():
    """Simulate traffic flow between resources."""
    import time
    import random
    import threading
    
    def simulate_traffic():
        ic("Starting traffic simulation")
        while True:
            # Get current topology
            topology = build_topology(k8s_client)
            
            # For each connection, simulate traffic
            for connection in topology['connections']:
                # Randomly determine if traffic is flowing on this connection
                if random.random() < 0.7:  # 70% chance of traffic flowing
                    # Generate traffic event
                    traffic_event = {
                        'source': connection['source'],
                        'target': connection['target'],
                        'intensity': random.randint(1, 10),
                        'timestamp': time.time()
                    }
                    
                    # Emit traffic event to all connected clients
                    socketio.emit('traffic_event', traffic_event)
            
            # Wait before next simulation cycle
            time.sleep(1)
    
    # Start simulation in a background thread
    simulation_thread = threading.Thread(target=simulate_traffic)
    simulation_thread.daemon = True
    simulation_thread.start()
    ic("Traffic simulation thread started")

@app.route('/websocket-test')
def websocket_test():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>WebSocket Test</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const status = document.getElementById('status');
                const output = document.getElementById('output');
                
                status.textContent = 'Connecting...';
                
                // Create the WebSocket connection
                const socket = io({
                    path: '/socket.io',
                    transports: ['websocket', 'polling']
                });
                
                socket.on('connect', () => {
                    status.textContent = 'Connected';
                    console.log('WebSocket connected');
                    addMessage('Connected to server');
                });
                
                socket.on('disconnect', () => {
                    status.textContent = 'Disconnected';
                    console.log('WebSocket disconnected');
                    addMessage('Disconnected from server');
                });
                
                socket.on('topology', (data) => {
                    console.log('Received topology:', data);
                    addMessage(`Received topology with ${data.nodes ? data.nodes.length : 0} nodes and ${data.namespaces ? data.namespaces.length : 0} namespaces`);
                    
                    // Display namespaces
                    const namespaces = data.namespaces || [];
                    document.getElementById('namespaces').innerHTML = namespaces.map(ns => 
                        `<li>${ns}</li>`).join('');
                });
                
                function addMessage(message) {
                    const el = document.createElement('div');
                    el.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
                    output.appendChild(el);
                }
            });
        </script>
    </head>
    <body>
        <h1>WebSocket Test</h1>
        <p>Status: <span id="status">Not connected</span></p>
        <h2>Namespaces</h2>
        <ul id="namespaces"></ul>
        <h2>Messages</h2>
        <div id="output"></div>
    </body>
    </html>
    '''

# At the bottom of app.py, in the main block
if __name__ == '__main__':
    # Start traffic simulation
    start_traffic_simulation()
    
    # Start the Flask+SocketIO application - CRITICAL: use 0.0.0.0, not 127.0.0.1
    port = int(os.environ.get('PORT', 5050))
    ic(f"Starting server on port {port} with host 0.0.0.0")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)