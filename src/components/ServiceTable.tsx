import React, { useState, useMemo } from 'react';
import { Table, Form, Badge, Button, InputGroup, FormCheck } from 'react-bootstrap';
import { ArcGISService } from '../types/arcgis.types';
import { StorageService } from '../services/storageService';

interface ServiceTableProps {
  services: ArcGISService[];
  onServiceSelect: (service: ArcGISService) => void;
}

const ServiceTable: React.FC<ServiceTableProps> = ({ services, onServiceSelect }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [favorites, setFavorites] = useState(StorageService.getFavorites());

  // Get unique service types for filter
  const serviceTypes = useMemo(() => {
    const types = new Set(services.map((s) => s.type));
    return ['all', ...Array.from(types)];
  }, [services]);

  // Filter services
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.folder && service.folder.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = filterType === 'all' || service.type === filterType;

      const matchesFavorites = !showFavoritesOnly || StorageService.isFavorite(service);

      // Status filtering
      let matchesStatus = true;
      if (filterStatus !== 'all') {
        if (filterStatus === 'accessible') {
          matchesStatus = !service.requiresAuth && !service.isEmpty && !service.error;
        } else if (filterStatus === 'auth-required') {
          matchesStatus = service.requiresAuth;
        } else if (filterStatus === 'empty') {
          matchesStatus = service.isEmpty;
        } else if (filterStatus === 'error') {
          matchesStatus = !!service.error;
        }
      }

      return matchesSearch && matchesType && matchesFavorites && matchesStatus;
    });
  }, [services, searchTerm, filterType, filterStatus, showFavoritesOnly]);

  const handleServiceClick = (service: ArcGISService) => {
    setSelectedServiceName(service.name);
    onServiceSelect(service);
  };

  const toggleFavorite = (service: ArcGISService, e: React.MouseEvent) => {
    e.stopPropagation();

    if (StorageService.isFavorite(service)) {
      const favoriteId = service.url;
      StorageService.removeFavorite(favoriteId);
    } else {
      StorageService.addFavorite(service);
    }

    setFavorites(StorageService.getFavorites());
  };

  const getStatusBadge = (service: ArcGISService) => {
    if (service.requiresAuth) {
      return <Badge bg="warning" text="dark">Auth Required</Badge>;
    }
    if (service.isEmpty) {
      return <Badge bg="secondary">Empty</Badge>;
    }
    if (service.error) {
      return <Badge bg="danger">Error</Badge>;
    }
    return <Badge bg="success">Accessible</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'MapServer': 'primary',
      'FeatureServer': 'info',
      'GeocodeServer': 'success',
      'GeometryServer': 'warning',
      'ImageServer': 'secondary',
      'GPServer': 'dark',
      'Folder': 'info',
    };

    return <Badge bg={colorMap[type] || 'secondary'}>{type}</Badge>;
  };

  const getResponseTimeBadge = (responseTime?: number) => {
    if (!responseTime) return null;

    let variant = 'success';
    if (responseTime > 2000) variant = 'danger';
    else if (responseTime > 500) variant = 'warning';

    return (
      <Badge bg={variant} title={`Response time: ${responseTime}ms`}>
        {responseTime}ms
      </Badge>
    );
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Services ({filteredServices.length})</h3>
        <FormCheck
          type="checkbox"
          label={`Show Favorites Only (${favorites.length})`}
          checked={showFavoritesOnly}
          onChange={(e) => setShowFavoritesOnly(e.target.checked)}
        />
      </div>

      {/* Search and Filter */}
      <div className="mb-3 d-flex gap-2">
        <InputGroup style={{ flex: 2 }}>
          <InputGroup.Text>Search</InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search by name, folder, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <Button variant="outline-secondary" onClick={() => setSearchTerm('')}>
              Clear
            </Button>
          )}
        </InputGroup>

        <Form.Select
          style={{ flex: 1 }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {serviceTypes.map((type) => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type}
            </option>
          ))}
        </Form.Select>

        <Form.Select
          style={{ flex: 1 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="accessible">Accessible</option>
          <option value="auth-required">Auth Required</option>
          <option value="empty">Empty</option>
          <option value="error">Error</option>
        </Form.Select>
      </div>

      {/* Services Table */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <Table striped bordered hover responsive>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
            <tr>
              <th style={{ width: '40px' }}>★</th>
              <th>Folder</th>
              <th>Service Name</th>
              <th>Type</th>
              <th>Layers</th>
              <th>Tables</th>
              <th>Status</th>
              <th>Response</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-muted">
                  No services found matching your criteria
                </td>
              </tr>
            ) : (
              filteredServices.map((service, index) => (
                <tr
                  key={`${service.name}-${index}`}
                  className={selectedServiceName === service.name ? 'table-active' : ''}
                >
                  <td className="text-center">
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-decoration-none"
                      style={{
                        fontSize: '1.5rem',
                        color: StorageService.isFavorite(service) ? '#ffc107' : '#dee2e6',
                      }}
                      onClick={(e) => toggleFavorite(service, e)}
                      title={
                        StorageService.isFavorite(service)
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                    >
                      ★
                    </Button>
                  </td>
                  <td>{service.folder}</td>
                  <td>
                    <div className="d-flex flex-column">
                      <span>{service.name.split('/').pop()}</span>
                      {service.description && (
                        <small className="text-muted">{service.description}</small>
                      )}
                    </div>
                  </td>
                  <td>{getTypeBadge(service.type)}</td>
                  <td className="text-center">
                    {service.layerCount !== undefined ? service.layerCount : '-'}
                  </td>
                  <td className="text-center">
                    {service.tableCount !== undefined ? service.tableCount : '-'}
                  </td>
                  <td>{getStatusBadge(service)}</td>
                  <td>{getResponseTimeBadge(service.responseTime)}</td>
                  <td>
                    {!service.isEmpty && !service.error && service.layerCount && service.layerCount > 0 ? (
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => handleServiceClick(service)}
                      >
                        Query
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => window.open(service.url, '_blank')}
                      >
                        View
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Summary */}
      <div className="mt-3">
        <small className="text-muted">
          Showing {filteredServices.length} of {services.length} services
        </small>
      </div>
    </div>
  );
};

export default ServiceTable;
