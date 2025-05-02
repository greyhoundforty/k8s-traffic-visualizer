"""
API routes for the Kubernetes Traffic Visualizer.
"""

import logging
from flask import Blueprint, request, jsonify, current_app
from icecream import ic

from models.resources import build_topology, get_traffic_flow_paths

logger = logging.getLogger(__name__)

def register_api_routes(app, k8s_client):
    """
    Register API routes with the Flask application.
    
    Args:
        app: Flask application instance
        k8s_client: Initialized KubernetesClient instance
    """
    # Create API blueprint
    api = Blueprint('api', __name__, url_prefix='/api')
    
    @api.route('/namespaces', methods=['GET'])
    def get_namespaces():
        """Get all available namespaces"""
        try:
            # Changed from get_all_namespaces to list_namespaces to match the KubernetesClient implementation
            ic("API route: Getting namespaces")
            namespaces = k8s_client.list_namespaces()
            ic("API route: Namespaces found:", namespaces)
            return jsonify({
                "namespaces": namespaces,
                "count": len(namespaces)
            })
        except Exception as e:
            ic("Error fetching namespaces:", e)
            logger.error(f"Error fetching namespaces: {e}")
            return jsonify({"error": str(e)}), 500
    
    @api.route('/topology', methods=['GET'])
    def get_topology():
        """Get topology of Kubernetes resources"""
        namespace = request.args.get('namespace', 'default')
        ic("API route: Getting topology for namespace:", namespace)
        
        try:
            topology = build_topology(k8s_client, namespace)
            ic("API route: Topology built with nodes:", len(topology.get('nodes', [])))
            return jsonify(topology)
        except Exception as e:
            ic("Error building topology:", e)
            logger.error(f"Error building topology: {e}")
            return jsonify({"error": str(e)}), 500
    
    @api.route('/traffic-paths', methods=['GET'])
    def get_traffic_paths():
        """Get all possible traffic flow paths"""
        namespace = request.args.get('namespace', 'default')
        ic("API route: Getting traffic paths for namespace:", namespace)
        
        try:
            paths = get_traffic_flow_paths(k8s_client, namespace)
            
            return jsonify({
                "namespace": namespace,
                "paths": paths,
                "count": len(paths)
            })
        except Exception as e:
            ic("Error building traffic paths:", e)
            logger.error(f"Error building traffic paths: {e}")
            return jsonify({"error": str(e)}), 500
    
    @api.route('/resources/<resource_type>', methods=['GET'])
    def get_resources(resource_type):
        """Get resources of a specific type"""
        namespace = request.args.get('namespace', 'default')
        ic("API route: Getting resources of type:", resource_type, "in namespace:", namespace)
        
        try:
            resources = {}
            if resource_type.lower() == 'pods':
                resources = k8s_client.get_resources(namespace).get('pods', [])
            elif resource_type.lower() == 'services':
                resources = k8s_client.get_resources(namespace).get('services', [])
            elif resource_type.lower() == 'deployments':
                resources = k8s_client.get_resources(namespace).get('deployments', [])
            elif resource_type.lower() == 'ingresses':
                resources = k8s_client.get_resources(namespace).get('ingresses', [])
            else:
                return jsonify({"error": f"Unsupported resource type: {resource_type}"}), 400
            
            ic("API route: Found resources count:", len(resources))
            return jsonify({
                "namespace": namespace,
                "resources": resources,
                "count": len(resources)
            })
        except Exception as e:
            ic("Error fetching resources:", e)
            logger.error(f"Error fetching {resource_type}: {e}")
            return jsonify({"error": str(e)}), 500
    
    @api.route('/resources/<resource_type>/<resource_name>', methods=['GET'])
    def get_resource_details(resource_type, resource_name):
        """Get detailed information about a specific resource"""
        namespace = request.args.get('namespace', 'default')
        ic("API route: Getting details for:", resource_type, resource_name, "in namespace:", namespace)
        
        try:
            details = k8s_client.get_resource_details(
                resource_type=resource_type, 
                resource_name=resource_name,
                namespace=namespace
            )
            
            return jsonify(details)
        except Exception as e:
            ic("Error fetching resource details:", e)
            logger.error(f"Error fetching details for {resource_type}/{resource_name}: {e}")
            return jsonify({"error": str(e)}), 500
    
    # Debug endpoint for namespaces
    @api.route('/debug/namespaces', methods=['GET'])
    def debug_namespaces():
        """Debug endpoint to directly get namespaces"""
        try:
            namespaces = k8s_client.list_namespaces()
            ic("Debug API: Namespaces:", namespaces)
            return jsonify({"namespaces": namespaces})
        except Exception as e:
            ic("Debug API: Error fetching namespaces:", e)
            return jsonify({"error": str(e)}), 500
    
    # Debug endpoint for resources
    @api.route('/debug/resources/<namespace>', methods=['GET'])
    def debug_resources(namespace):
        """Debug endpoint to get resource counts"""
        try:
            resources = k8s_client.get_resources(namespace)
            counts = {
                'pods': len(resources.get('pods', [])),
                'services': len(resources.get('services', [])),
                'deployments': len(resources.get('deployments', [])),
                'ingresses': len(resources.get('ingresses', []))
            }
            ic("Debug API: Resource counts:", counts)
            return jsonify({"resource_counts": counts})
        except Exception as e:
            ic("Debug API: Error fetching resources:", e)
            return jsonify({"error": str(e)}), 500
    
    # Register the blueprint with the app
    app.register_blueprint(api)
    
    # Add CORS headers
    @app.after_request
    def add_cors_headers(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    ic("API routes registered")
    logger.info("API routes registered")