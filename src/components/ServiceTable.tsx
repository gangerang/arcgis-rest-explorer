import React, { useState, useMemo } from 'react';
import { Table, Form, Badge, Button, InputGroup, FormCheck } from 'react-bootstrap';
import { ArcGISService } from '../types/arcgis.types';
import { StorageService } from '../services/storageService';
import { AuthService } from '../services/authService';

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
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Helper to add token to URL
  const addTokenToUrl = (url: string): string => {
    const token = AuthService.getToken(url);
    if (token) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('token', token);
      return urlObj.toString();
    }
    return url;
  };

  // Get unique service types for filter
  const serviceTypes = useMemo(() => {
    const types = new Set(services.map((s) => s.type));
    return ['all', ...Array.from(types)];
  }, [services]);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort services
  const filteredServices = useMemo(() => {
    let filtered = services.filter((service) => {
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

    // Apply sorting
    if (sortColumn) {
      filtered = filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case 'folder':
            aVal = a.folder || '';
            bVal = b.folder || '';
            break;
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
          case 'type':
            aVal = a.type || '';
            bVal = b.type || '';
            break;
          case 'resources':
            aVal = (a.layerCount || 0) + (a.tableCount || 0);
            bVal = (b.layerCount || 0) + (b.tableCount || 0);
            break;
          case 'status':
            aVal = a.requiresAuth ? 3 : a.isEmpty ? 2 : a.error ? 4 : 1;
            bVal = b.requiresAuth ? 3 : b.isEmpty ? 2 : b.error ? 4 : 1;
            break;
          default:
            return 0;
        }

        if (typeof aVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        } else {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
      });
    }

    return filtered;
  }, [services, searchTerm, filterType, filterStatus, showFavoritesOnly, sortColumn, sortDirection]);

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

  const renderSortableHeader = (column: string, label: string) => {
    let className = '';
    if (column === 'folder') className = 'hide-mobile-folder';
    if (column === 'resources') className = 'hide-mobile-resources';

    return (
      <th
        onClick={() => handleSort(column)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title={`Sort by ${label}`}
        className={className}
      >
        {label}
      </th>
    );
  };

  return (
    <div className="service-table-mobile">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-3 gap-2">
        <h3 className="mb-0">Services ({filteredServices.length})</h3>
        <FormCheck
          type="checkbox"
          label={`Show Favorites Only (${favorites.length})`}
          checked={showFavoritesOnly}
          onChange={(e) => setShowFavoritesOnly(e.target.checked)}
        />
      </div>

      {/* Search and Filter */}
      <div className="mb-3 d-flex gap-2 mobile-stack-filters">
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
      <div className="table-responsive">
        <Table striped bordered hover>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
            <tr>
              <th style={{ width: '40px' }}>★</th>
              {renderSortableHeader('folder', 'Folder')}
              {renderSortableHeader('name', 'Service Name')}
              {renderSortableHeader('type', 'Type')}
              {renderSortableHeader('resources', 'Resources')}
              {renderSortableHeader('status', 'Status')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted">
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
                      className="p-0 text-decoration-none favorite-star-btn"
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
                  <td className="hide-mobile-folder">
                    {service.folder ? (
                      <a
                        href={addTokenToUrl(`${service.url.split('/').slice(0, -1).join('/')}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {service.folder}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <a
                        href={addTokenToUrl(service.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {service.name.split('/').pop()}
                      </a>
                      {service.description && (
                        <small className="text-muted">{service.description}</small>
                      )}
                    </div>
                  </td>
                  <td>{getTypeBadge(service.type)}</td>
                  <td className="text-center hide-mobile-resources">
                    {((service.layerCount || 0) + (service.tableCount || 0)) || '-'}
                  </td>
                  <td>{getStatusBadge(service)}</td>
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
                        onClick={() => window.open(addTokenToUrl(service.url), '_blank')}
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
