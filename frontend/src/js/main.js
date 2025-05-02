/**
 * Kubernetes Traffic Flow Visualization
 * This script creates an interactive visualization of Kubernetes resources
 * and the traffic flowing between them.
 */

// Config
const config = {
    // API endpoints
    api: {
        base: '/api',
        namespaces: '/api/namespaces',
        topology: '/api/topology',
        trafficPaths: '/api/traffic-paths',
        resources: '/api/resources'
    },
    // Socket.IO server URL (same as the backend in development)
    socketUrl: window.location.origin,
    // Visualization settings
    visualization: {
        // Node sizes
        nodeRadius: {
            ingress: 20,
            service: 18,
            deployment: 16,
            pod: 14
        },
        // Force simulation settings
        force: {
            linkDistance: 100,
            charge: -400,
            gravity: 0.1
        },
        // Animation settings
        animation: {
            // Duration of zoom transitions
            transitionDuration: 750,
            // Traffic particle speed
            particleSpeed: 2000, // ms to travel along a path
            // Number of particles per active connection
            particlesPerPath: 3
        }
    }
};

// Global variables
let svg;
let simulation;
let zoom;
let topology = { nodes: [], connections: [] };
let socket;
let activeNamespace = 'default';
let trafficParticles = [];
let isSimulationRunning = false;

// DOM elements
const elements = {
    namespaceSelect: document.getElementById('namespace-select'),
    refreshButton: document.getElementById('refresh-btn'),
    topologySvg: document.getElementById('topology-svg'),
    detailsContent: document.getElementById('details-content'),
    connectionStatus: document.getElementById('connection-status')
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    initializeSocket();
    initializeUI();
    initializeVisualization();
    loadNamespaces();
    loadTopology();
});

/**
 * Initialize Socket.IO connection for real-time updates
 */
function initializeSocket() {
    console.log('Initializing Socket.IO connection to:', config.socketUrl);
    
    // Configure Socket.IO with explicit transport options and debugging
    socket = io(config.socketUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: true
    });
    
    // Add connection event handlers with debugging
    socket.on('connect', () => {
        console.log('WebSocket connected successfully');
        elements.connectionStatus.textContent = 'Connected';
        elements.connectionStatus.style.color = '#4caf50';
    });
    
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        elements.connectionStatus.textContent = 'Connection Error';
        elements.connectionStatus.style.color = '#f44336';
    });
    
    socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        elements.connectionStatus.textContent = 'Disconnected';
        elements.connectionStatus.style.color = '#f44336';
    });
    
    socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });
    
    socket.on('topology', (data) => {
        console.log('Received topology data:', data);
        
        // Check if we got namespace data and update dropdown
        if (data.namespaces && data.namespaces.length > 0) {
            updateNamespaceDropdown(data.namespaces);
        }
        
        topology = data;
        updateVisualization();
    });
    
    socket.on('traffic_event', (event) => {
        animateTraffic(event);
    });
    
    socket.on('resource_details', (details) => {
        displayResourceDetails(details);
    });
    
    // Manually attempt to connect if needed
    if (!socket.connected) {
        console.log('Socket not connected, attempting manual connection...');
        socket.connect();
    }
}

/**
 * Update the namespace dropdown with available namespaces
 */
function updateNamespaceDropdown(namespaces) {
    if (!namespaces || !Array.isArray(namespaces) || namespaces.length === 0) {
        console.warn('No namespaces received or invalid format');
        return;
    }
    
    console.log('Updating namespace dropdown with:', namespaces);
    
    // Clear select options
    elements.namespaceSelect.innerHTML = '';
    
    // Add namespace options
    namespaces.forEach(namespace => {
        const option = document.createElement('option');
        option.value = namespace;
        option.textContent = namespace;
        elements.namespaceSelect.appendChild(option);
    });
    
    // Set the active namespace
    elements.namespaceSelect.value = activeNamespace;
}

/**
 * Initialize UI event listeners
 */
function initializeUI() {
    // Namespace selection
    elements.namespaceSelect.addEventListener('change', (e) => {
        activeNamespace = e.target.value;
        console.log('Changing namespace to:', activeNamespace);
        
        // Emit namespace change event to WebSocket
        socket.emit('change_namespace', { namespace: activeNamespace });
        
        // Also try regular HTTP request as fallback
        loadTopology();
    });
    
    // Refresh button
    elements.refreshButton.addEventListener('click', () => {
        console.log('Refreshing topology');
        socket.emit('change_namespace', { namespace: activeNamespace });
        loadTopology();
    });
}

/**
 * Load available namespaces from the API
 */
async function loadNamespaces() {
    try {
        console.log('Fetching namespaces from API endpoint:', config.api.namespaces);
        const response = await fetch(config.api.namespaces);
        const data = await response.json();
        
        console.log('Received namespaces data:', data);
        
        if (data.namespaces && Array.isArray(data.namespaces)) {
            updateNamespaceDropdown(data.namespaces);
        } else {
            console.error('Invalid namespace data format:', data);
            
            // Fallback: try to get namespaces from the debug endpoint
            console.log('Trying debug fallback...');
            fetch('/api/debug/namespaces')
                .then(response => response.json())
                .then(data => {
                    if (data.namespaces) {
                        updateNamespaceDropdown(data.namespaces);
                    }
                })
                .catch(error => {
                    console.error('Fallback namespace fetch failed:', error);
                });
        }
    } catch (error) {
        console.error('Failed to load namespaces:', error);
        
        // Add a manual fallback option if everything fails
        console.log('Adding default namespace as fallback');
        const defaultNamespace = document.createElement('option');
        defaultNamespace.value = 'default';
        defaultNamespace.textContent = 'default';
        elements.namespaceSelect.innerHTML = '';
        elements.namespaceSelect.appendChild(defaultNamespace);
    }
}

/**
 * Load topology data for the active namespace
 */
async function loadTopology() {
    try {
        console.log(`Loading topology for namespace: ${activeNamespace}`);
        const response = await fetch(`${config.api.topology}?namespace=${activeNamespace}`);
        const data = await response.json();
        
        console.log('Received topology data via HTTP:', data);
        
        topology = data;
        updateVisualization();
    } catch (error) {
        console.error('Failed to load topology:', error);
    }
}

/**
 * Initialize D3.js visualization
 */
function initializeVisualization() {
    // Create SVG element
    svg = d3.select('#topology-svg');
    
    // Define zoom behavior
    zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            d3.select('g.visualization-container')
                .attr('transform', event.transform);
        });
    
    // Apply zoom behavior to SVG
    svg.call(zoom);
    
    // Create container for all visualization elements
    svg.append('g')
        .attr('class', 'visualization-container');
    
    // Create groups for different elements (ordering matters for z-index)
    svg.select('g.visualization-container')
        .append('g').attr('class', 'links');
    
    svg.select('g.visualization-container')
        .append('g').attr('class', 'particles');
    
    svg.select('g.visualization-container')
        .append('g').attr('class', 'nodes');
    
    // Initialize force simulation
    simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(config.visualization.force.linkDistance))
        .force('charge', d3.forceManyBody().strength(config.visualization.force.charge))
        .force('center', d3.forceCenter(
            elements.topologySvg.clientWidth / 2, 
            elements.topologySvg.clientHeight / 2
        ))
        .force('x', d3.forceX(elements.topologySvg.clientWidth / 2).strength(config.visualization.force.gravity))
        .force('y', d3.forceY(elements.topologySvg.clientHeight / 2).strength(config.visualization.force.gravity))
        .on('tick', simulationTick);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        simulation.force('center', d3.forceCenter(
            elements.topologySvg.clientWidth / 2, 
            elements.topologySvg.clientHeight / 2
        ));
        simulation.force('x', d3.forceX(elements.topologySvg.clientWidth / 2).strength(config.visualization.force.gravity));
        simulation.force('y', d3.forceY(elements.topologySvg.clientHeight / 2).strength(config.visualization.force.gravity));
        simulation.alpha(0.3).restart();
    });
}

/**
 * Update the visualization with the current topology data
 */
function updateVisualization() {
    if (!topology.nodes || !topology.connections) {
        console.error('Invalid topology data', topology);
        return;
    }
    
    console.log(`Updating visualization with ${topology.nodes.length} nodes and ${topology.connections.length} connections`);
    
    // Prepare data for visualization
    const nodes = topology.nodes.map(node => ({...node}));
    const links = topology.connections.map(conn => ({
        id: conn.id || `${conn.source}-${conn.target}`,
        source: conn.source,
        target: conn.target,
        type: conn.type,
        port: conn.port
    }));
    
    // Update nodes
    const nodeElements = svg.select('g.nodes')
        .selectAll('g.node')
        .data(nodes, d => d.id);
    
    // Remove old nodes
    nodeElements.exit().remove();
    
    // Create new nodes
    const nodeEnter = nodeElements.enter()
        .append('g')
        .attr('class', d => `node ${d.type} ${d.status === 'running' ? 'active' : 'inactive'}`)
        .on('click', nodeClicked);
    
    // Add node circles
    nodeEnter.append('circle')
        .attr('r', d => config.visualization.nodeRadius[d.type] || 15)
        .attr('class', d => `status-${d.status}`);
    
    // Add node icons (using symbols)
    nodeEnter.append('use')
        .attr('href', d => `#icon-${d.type}`)
        .attr('class', 'k8s-icon')
        .attr('width', d => config.visualization.nodeRadius[d.type] * 1.2)
        .attr('height', d => config.visualization.nodeRadius[d.type] * 1.2)
        .attr('x', d => -config.visualization.nodeRadius[d.type] * 0.6)
        .attr('y', d => -config.visualization.nodeRadius[d.type] * 0.6);
    
    // Add node labels
    nodeEnter.append('text')
        .attr('dy', d => config.visualization.nodeRadius[d.type] + 12)
        .text(d => d.name);
    
    // Merge new and existing nodes
    const nodeUpdate = nodeEnter.merge(nodeElements);
    
    // Update node classes (for status changes)
    nodeUpdate
        .attr('class', d => `node ${d.type} ${d.status === 'running' ? 'active' : 'inactive'}`);
    
    // Update node circles
    nodeUpdate.select('circle')
        .attr('class', d => `status-${d.status}`);
    
    // Update links
    const linkElements = svg.select('g.links')
        .selectAll('path.link')
        .data(links, d => d.id);
    
    // Remove old links
    linkElements.exit().remove();
    
    // Create new links
    const linkEnter = linkElements.enter()
        .append('path')
        .attr('class', d => `link ${d.type}`)
        .attr('data-source', d => d.source)
        .attr('data-target', d => d.target);
    
    // Merge new and existing links
    const linkUpdate = linkEnter.merge(linkElements);
    
    // Update force simulation
    simulation.nodes(nodes);
    simulation.force('link').links(links);
    
    // Restart simulation
    simulation.alpha(1).restart();
    isSimulationRunning = true;
    
    // Reset zoom if needed
    if (nodes.length > 0 && !nodeElements.size()) {
        resetZoom();
    }
}

/**
 * Handle force simulation tick
 */
function simulationTick() {
    // Update node positions
    svg.selectAll('g.node')
        .attr('transform', d => `translate(${d.x}, ${d.y})`);
    
    // Update link paths
    svg.selectAll('path.link')
        .attr('d', d => {
            // Calculate path with a curve
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curve factor
            
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });
    
    // Update particle positions
    updateParticlePositions();
}

/**
 * Reset zoom to fit all nodes
 */
function resetZoom() {
    const boundsNode = svg.select('g.nodes').node();
    if (!boundsNode) return;
    
    const bounds = boundsNode.getBBox();
    const width = elements.topologySvg.clientWidth;
    const height = elements.topologySvg.clientHeight;
    
    // Add padding
    const padding = 40;
    const dx = bounds.width + padding * 2;
    const dy = bounds.height + padding * 2;
    const x = bounds.x - padding;
    const y = bounds.y - padding;
    
    // Calculate scale and translate
    const scale = Math.min(0.8, Math.min(width / dx, height / dy));
    const translate = [width / 2 - scale * (x + dx / 2), height / 2 - scale * (y + dy / 2)];
    
    // Apply zoom transform
    svg.transition()
        .duration(config.visualization.animation.transitionDuration)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}

/**
 * Handle node click event
 */
function nodeClicked(event, d) {
    // Stop propagation to prevent zoom
    event.stopPropagation();
    
    console.log(`Node clicked: ${d.type}/${d.name} in namespace ${activeNamespace}`);
    
    // Request resource details
    socket.emit('get_resource_details', {
        resource_type: d.type,
        resource_name: d.name,
        namespace: activeNamespace
    });
    
    // Highlight the selected node
    svg.selectAll('g.node')
        .classed('selected', false);
    
    d3.select(this)
        .classed('selected', true);
    
    // Temporary display simple details while waiting for full details
    displaySimpleResourceDetails(d);
}

/**
 * Display simple resource details while waiting for full details
 */
function displaySimpleResourceDetails(resource) {
    const details = document.createElement('div');
    
    // Add resource icon
    const iconDiv = document.createElement('div');
    iconDiv.className = `k8s-icon-container ${resource.type}`;
    iconDiv.innerHTML = `<svg class="k8s-icon"><use href="#icon-${resource.type}"></use></svg>`;
    details.appendChild(iconDiv);
    
    // Add resource name
    const nameHeader = document.createElement('h3');
    nameHeader.textContent = resource.name;
    details.appendChild(nameHeader);
    
    // Add resource type
    const typeP = document.createElement('p');
    typeP.innerHTML = `<span class="resource-label">Type:</span> ${resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}`;
    details.appendChild(typeP);
    
    // Add status
    const statusDiv = document.createElement('div');
    statusDiv.innerHTML = `<span class="status-badge ${resource.status}">${resource.status}</span>`;
    details.appendChild(statusDiv);
    
    // Add loading message
    const loadingP = document.createElement('p');
    loadingP.textContent = 'Loading detailed information...';
    details.appendChild(loadingP);
    
    // Update details panel
    elements.detailsContent.innerHTML = '';
    elements.detailsContent.appendChild(details);
}

/**
 * Display full resource details received from backend
 */
function displayResourceDetails(resource) {
    if (resource.error) {
        elements.detailsContent.innerHTML = `<p>Error: ${resource.error}</p>`;
        return;
    }
    
    const details = document.createElement('div');
    
    // Add resource icon
    const iconDiv = document.createElement('div');
    iconDiv.className = `k8s-icon-container ${resource.kind.toLowerCase()}`;
    iconDiv.innerHTML = `<svg class="k8s-icon"><use href="#icon-${resource.kind.toLowerCase()}"></use></svg>`;
    details.appendChild(iconDiv);
    
    // Add resource name and kind
    const nameHeader = document.createElement('h3');
    nameHeader.textContent = `${resource.name} (${resource.kind})`;
    details.appendChild(nameHeader);
    
    // Add status if available
    if (resource.status) {
        const statusDiv = document.createElement('div');
        statusDiv.innerHTML = `<span class="status-badge ${resource.status.toLowerCase()}">${resource.status}</span>`;
        details.appendChild(statusDiv);
    }
    
    // Add namespace
    const namespaceP = document.createElement('p');
    namespaceP.innerHTML = `<span class="resource-label">Namespace:</span> ${resource.namespace}`;
    details.appendChild(namespaceP);
    
    // Add resource-specific details
    const detailSection = document.createElement('div');
    detailSection.className = 'detail-section';
    
    switch (resource.kind.toLowerCase()) {
        case 'pod':
            detailSection.innerHTML = `
                <p><span class="resource-label">Node:</span> ${resource.node || 'N/A'}</p>
                <p><span class="resource-label">IP:</span> ${resource.ip || 'N/A'}</p>
                <p><span class="resource-label">Created:</span> ${formatDate(resource.created_at)}</p>
                <h4>Containers:</h4>
                <ul>
                    ${resource.containers.map(container => `
                        <li>${container.name} (${container.image})</li>
                    `).join('')}
                </ul>
            `;
            break;
            
        case 'service':
            detailSection.innerHTML = `
                <p><span class="resource-label">Type:</span> ${resource.type}</p>
                <p><span class="resource-label">Cluster IP:</span> ${resource.cluster_ip || 'N/A'}</p>
                <h4>Ports:</h4>
                <ul>
                    ${resource.ports.map(port => `
                        <li>${port.port} → ${port.target_port} (${port.protocol})</li>
                    `).join('')}
                </ul>
                <h4>Selector:</h4>
                <ul>
                    ${Object.entries(resource.selector || {}).map(([key, value]) => `
                        <li>${key}: ${value}</li>
                    `).join('')}
                </ul>
            `;
            break;
            
        case 'deployment':
            detailSection.innerHTML = `
                <p><span class="resource-label">Replicas:</span> ${resource.ready_replicas || 0}/${resource.replicas}</p>
                <p><span class="resource-label">Strategy:</span> ${resource.strategy?.type || 'N/A'}</p>
                <h4>Selector:</h4>
                <ul>
                    ${Object.entries(resource.selector || {}).map(([key, value]) => `
                        <li>${key}: ${value}</li>
                    `).join('')}
                </ul>
                <h4>Pod Template:</h4>
                <ul>
                    ${resource.pod_template?.containers.map(container => `
                        <li>${container.name} (${container.image})</li>
                    `).join('')}
                </ul>
            `;
            break;
            
        case 'ingress':
            detailSection.innerHTML = `
                <h4>Rules:</h4>
                <ul>
                    ${resource.rules.map(rule => `
                        <li>${rule.host}${rule.path} → ${rule.backend_service_name}:${rule.backend_service_port}</li>
                    `).join('')}
                </ul>
                ${resource.tls && resource.tls.length ? `
                    <h4>TLS:</h4>
                    <ul>
                        ${resource.tls.map(tls => `
                            <li>Hosts: ${tls.hosts.join(', ')}<br>Secret: ${tls.secret_name}</li>
                        `).join('')}
                    </ul>
                ` : ''}
            `;
            break;
            
        default:
            detailSection.innerHTML = `<p>No specific details available for this resource type.</p>`;
    }
    
    details.appendChild(detailSection);
    
    // Add events section if available
    if (resource.events && resource.events.length) {
        const eventsHeader = document.createElement('h3');
        eventsHeader.textContent = 'Events';
        details.appendChild(eventsHeader);
        
        const eventsList = document.createElement('ul');
        resource.events.forEach(event => {
            const eventItem = document.createElement('li');
            eventItem.innerHTML = `
                <strong>${event.reason}</strong> (${event.type}): ${event.message}
                <small>${formatDate(event.last_timestamp)}</small>
            `;
            eventsList.appendChild(eventItem);
        });
        details.appendChild(eventsList);
    }
    
    // Update details panel
    elements.detailsContent.innerHTML = '';
    elements.detailsContent.appendChild(details);
}

/**
 * Animate traffic flow along a connection
 */
function animateTraffic(trafficEvent) {
    // Find the link for this traffic
    const link = d3.select(`path.link[data-source="${trafficEvent.source}"][data-target="${trafficEvent.target}"]`);
    
    if (!link.node()) return;
    
    // Get the link path
    const path = link.node();
    const pathLength = path.getTotalLength();
    
    // Create particles based on intensity
    const particleCount = Math.min(
        trafficEvent.intensity, 
        config.visualization.animation.particlesPerPath
    );
    
    // Create particles at staggered positions
    for (let i = 0; i < particleCount; i++) {
        const particleId = `particle-${Date.now()}-${i}`;
        const startOffset = (i / particleCount) * pathLength;
        
        // Create particle element
        const particle = svg.select('g.particles')
            .append('circle')
            .attr('class', 'traffic-particle')
            .attr('r', 3)
            .attr('id', particleId);
        
        // Start particle animation
        animateParticle(
            particle, 
            path, 
            startOffset, 
            pathLength, 
            config.visualization.animation.particleSpeed
        );
        
        // Add to tracking array
        trafficParticles.push({
            id: particleId,
            element: particle,
            path: path,
            startTime: Date.now(),
            startOffset: startOffset,
            pathLength: pathLength,
            duration: config.visualization.animation.particleSpeed
        });
    }
}

/**
 * Animate a single traffic particle along a path
 */
function animateParticle(particle, path, startOffset, pathLength, duration) {
    particle
        .attr('opacity', 0)
        .transition()
        .duration(50)
        .attr('opacity', 1)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attrTween('transform', () => {
            return (t) => {
                // Calculate position along the path
                const offset = (startOffset + t * pathLength) % pathLength;
                const point = path.getPointAtLength(offset);
                return `translate(${point.x}, ${point.y})`;
            };
        })
        .on('end', function() {
            // Remove particle when animation is complete
            particle.remove();
            // Remove from tracking array
            trafficParticles = trafficParticles.filter(p => p.id !== particle.attr('id'));
        });
}

/**
 * Update positions of all active particles based on simulation progress
 */
function updateParticlePositions() {
    const currentTime = Date.now();
    
    trafficParticles.forEach(particle => {
        // Calculate elapsed time
        const elapsed = currentTime - particle.startTime;
        
        // Calculate progress (0-1)
        const progress = Math.min(elapsed / particle.duration, 1);
        
        // Calculate position along the path
        const offset = (particle.startOffset + progress * particle.pathLength) % particle.pathLength;
        const point = particle.path.getPointAtLength(offset);
        
        // Update particle position
        particle.element.attr('transform', `translate(${point.x}, ${point.y})`);
    });
}

/**
 * Format a date string
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString();
}