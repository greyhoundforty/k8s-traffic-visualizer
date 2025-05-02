#!/usr/bin/env python3
"""
Kubernetes client for interacting with the Kubernetes API.
"""

import os
import logging
import kubernetes as k8s
from kubernetes.client.rest import ApiException
from icecream import ic

class KubernetesClient:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Configure and initialize Kubernetes client
        try:
            k8s.config.load_kube_config()
            ic("Using local kubeconfig")
            self.logger.info("Loaded Kubernetes config from default location")
        except Exception:
            try:
                k8s.config.load_incluster_config()
                ic("Using in-cluster config")
                self.logger.info("Loaded Kubernetes config from in-cluster")
            except Exception as e:
                self.logger.error(f"Failed to load Kubernetes configuration: {e}")
                ic("Failed to load any Kubernetes configuration", e)
                raise
        
        # Initialize API clients
        self.core_v1 = k8s.client.CoreV1Api()
        self.apps_v1 = k8s.client.AppsV1Api()
        self.networking_v1 = k8s.client.NetworkingV1Api()
        
        ic("Kubernetes client initialized successfully")
        self.logger.info("Kubernetes client initialized")
    
    def list_namespaces(self):
        """List all namespaces in the cluster."""
        try:
            result = self.core_v1.list_namespace()
            namespaces = [item.metadata.name for item in result.items]
            ic("Available namespaces:", namespaces)
            return namespaces
        except ApiException as e:
            ic("Error listing namespaces:", e.status, e.reason)
            self.logger.error(f"Error listing namespaces: {e}")
            return []
    
    def get_resources(self, namespace="default"):
        """Get all resources in the specified namespace."""
        ic("Getting resources for namespace:", namespace)
        try:
            # Get pods
            pods = self.core_v1.list_namespaced_pod(namespace)
            ic("Pods found:", len(pods.items))
            
            # Get services
            services = self.core_v1.list_namespaced_service(namespace)
            ic("Services found:", len(services.items))
            
            # Get deployments
            deployments = self.apps_v1.list_namespaced_deployment(namespace)
            ic("Deployments found:", len(deployments.items))
            
            # Get ingresses
            try:
                ingresses = self.networking_v1.list_namespaced_ingress(namespace)
                ic("Ingresses found:", len(ingresses.items))
            except ApiException as e:
                ic("Error getting ingresses:", e.status, e.reason)
                ingresses = {'items': []}
            
            return {
                'pods': pods.items,
                'services': services.items,
                'deployments': deployments.items,
                'ingresses': ingresses.items
            }
        except ApiException as e:
            ic("Error getting resources:", e.status, e.reason)
            self.logger.error(f"Error getting resources: {e}")
            return {'pods': [], 'services': [], 'deployments': [], 'ingresses': []}
    
    def get_resource_details(self, resource_type, resource_name, namespace="default"):
        """Get detailed information about a specific resource."""
        ic("Getting details for:", resource_type, resource_name, namespace)
        try:
            if resource_type == 'pod':
                result = self.core_v1.read_namespaced_pod(resource_name, namespace)
            elif resource_type == 'service':
                result = self.core_v1.read_namespaced_service(resource_name, namespace)
            elif resource_type == 'deployment':
                result = self.apps_v1.read_namespaced_deployment(resource_name, namespace)
            elif resource_type == 'ingress':
                result = self.networking_v1.read_namespaced_ingress(resource_name, namespace)
            else:
                ic("Unknown resource type:", resource_type)
                return None
            
            # Convert to dict and return
            result_dict = self._object_to_dict(result)
            ic("Resource details retrieved successfully")
            return result_dict
        except ApiException as e:
            ic("Error getting resource details:", e.status, e.reason)
            self.logger.error(f"Error getting resource details: {e}")
            return None
    
    def _object_to_dict(self, obj):
        """Convert Kubernetes object to dictionary."""
        result = {}
        if hasattr(obj, 'to_dict'):
            result = obj.to_dict()
        else:
            ic("Object doesn't have to_dict method, using vars()")
            result = vars(obj)
        return result