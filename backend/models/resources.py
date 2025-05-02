#!/usr/bin/env python3
"""
Resource models for the Kubernetes Traffic Visualizer.
This module handles building the topology of the Kubernetes cluster.
"""

import logging
from icecream import ic

logger = logging.getLogger(__name__)

def build_topology(k8s_client, selected_namespace="default"):
    """Build a topology of the cluster resources and their connections."""
    ic("Building topology")
    
    # Get all namespaces
    namespaces = k8s_client.list_namespaces()
    ic("Found namespaces:", namespaces)
    
    # Use the selected namespace
    namespace = selected_namespace
    ic("Using namespace:", namespace)
    resources = k8s_client.get_resources(namespace)
    # Extract nodes and connections
    nodes = []
    connections = []
    
    # Process pods
    ic("Processing pods:", len(resources['pods']))
    for pod in resources['pods']:
        pod_name = pod.metadata.name
        ic("Processing pod:", pod_name)
        nodes.append({
            'id': f"pod:{pod_name}",
            'type': 'pod',
            'name': pod_name,
            'namespace': namespace,
            'status': pod.status.phase
        })
    
    # Process services
    ic("Processing services:", len(resources['services']))
    for service in resources['services']:
        service_name = service.metadata.name
        ic("Processing service:", service_name)
        nodes.append({
            'id': f"service:{service_name}",
            'type': 'service',
            'name': service_name,
            'namespace': namespace,
            'ports': [f"{port.port}/{port.protocol}" for port in service.spec.ports] if service.spec.ports else []
        })
        
        # Connect services to pods based on selector
        if service.spec.selector:
            ic("Service selector:", service.spec.selector)
            for pod in resources['pods']:
                if pod.metadata.labels:
                    matches = all(
                        pod.metadata.labels.get(key) == value 
                        for key, value in service.spec.selector.items()
                    )
                    if matches:
                        ic(f"Service {service_name} matches pod {pod.metadata.name}")
                        connections.append({
                            'source': f"service:{service_name}",
                            'target': f"pod:{pod.metadata.name}",
                            'type': 'service-pod'
                        })
    
    # Process deployments
    ic("Processing deployments:", len(resources['deployments']))
    for deployment in resources['deployments']:
        deployment_name = deployment.metadata.name
        ic("Processing deployment:", deployment_name)
        nodes.append({
            'id': f"deployment:{deployment_name}",
            'type': 'deployment',
            'name': deployment_name,
            'namespace': namespace,
            'replicas': deployment.spec.replicas
        })
        
        # Connect deployments to pods based on selector
        if deployment.spec.selector and deployment.spec.selector.match_labels:
            ic("Deployment selector:", deployment.spec.selector.match_labels)
            for pod in resources['pods']:
                if pod.metadata.labels:
                    matches = all(
                        pod.metadata.labels.get(key) == value 
                        for key, value in deployment.spec.selector.match_labels.items()
                    )
                    if matches:
                        ic(f"Deployment {deployment_name} matches pod {pod.metadata.name}")
                        connections.append({
                            'source': f"deployment:{deployment_name}",
                            'target': f"pod:{pod.metadata.name}",
                            'type': 'deployment-pod'
                        })
    
    # Process ingresses
    ic("Processing ingresses:", len(resources['ingresses']))
    for ingress in resources['ingresses']:
        ingress_name = ingress.metadata.name
        ic("Processing ingress:", ingress_name)
        nodes.append({
            'id': f"ingress:{ingress_name}",
            'type': 'ingress',
            'name': ingress_name,
            'namespace': namespace,
            'hosts': [rule.host for rule in ingress.spec.rules] if ingress.spec.rules else []
        })
        
        # Connect ingresses to services
        if ingress.spec.rules:
            for rule in ingress.spec.rules:
                if rule.http and rule.http.paths:
                    for path in rule.http.paths:
                        if path.backend.service and path.backend.service.name:
                            service_name = path.backend.service.name
                            ic(f"Ingress {ingress_name} connects to service {service_name}")
                            connections.append({
                                'source': f"ingress:{ingress_name}",
                                'target': f"service:{service_name}",
                                'type': 'ingress-service'
                            })
    
    ic("Topology complete - nodes:", len(nodes), "connections:", len(connections))
    return {
        'nodes': nodes,
        'connections': connections,
        'namespaces': namespaces,
        'current_namespace': namespace  # Add the current namespace to the response
    }

def get_traffic_flow_paths(k8s_client, namespace="default"):
    """
    Calculate traffic flow paths between resources.
    This is used for the traffic simulation visualization.
    """
    ic("Calculating traffic flow paths for namespace:", namespace)
    
    topology = build_topology(k8s_client)
    nodes = topology['nodes']
    connections = topology['connections']
    
    # Create a graph of connections for path finding
    graph = {}
    for node in nodes:
        node_id = node['id']
        graph[node_id] = []
    
    for conn in connections:
        source = conn['source']
        target = conn['target']
        if source in graph:
            graph[source].append(target)
        if target in graph:  # Add reverse connection for bidirectional traffic
            graph[target].append(source)
    
    # Find all possible paths between ingresses/services and pods
    paths = []
    entry_points = [node['id'] for node in nodes 
                  if node['type'] in ('ingress', 'service')]
    endpoints = [node['id'] for node in nodes if node['type'] == 'pod']
    
    ic("Entry points:", len(entry_points))
    ic("Endpoints:", len(endpoints))
    
    # Simple BFS to find paths
    for start in entry_points:
        for end in endpoints:
            if start == end:
                continue
            
            queue = [[start]]
            visited = set([start])
            
            while queue:
                path = queue.pop(0)
                node = path[-1]
                
                if node == end:
                    paths.append(path)
                    break
                
                for neighbor in graph.get(node, []):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        new_path = list(path)
                        new_path.append(neighbor)
                        queue.append(new_path)
    
    ic("Found traffic flow paths:", len(paths))
    return paths