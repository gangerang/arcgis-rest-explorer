import React, { useState, useMemo } from 'react';
import { Table, Form, Badge, Button, InputGroup } from 'react-bootstrap';
import { ArcGISService } from '../types/arcgis.types';

interface ServiceTableProps {
  services: ArcGISService[];
  onServiceSelect: (service: ArcGISService) => void;
}

const ServiceTable: React.FC<ServiceTableProps> = ({ services, onServiceSelect }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');

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

      return matchesSearch && matchesType;
    });
  }, [services, searchTerm, filterType]);

  const handleServiceClick = (service: ArcGISService) => {
    setSelectedServiceName(service.name);
    onServiceSelect(service);
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
      'Folder': 'light',
    };

    return <Badge bg={colorMap[type] || 'secondary'}>{type}</Badge>;
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Services ({filteredServices.length})</h3>
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
      </div>

      {/* Services Table */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <Table striped bordered hover responsive>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
            <tr>
              <th>Folder</th>
              <th>Service Name</th>
              <th>Type</th>
              <th>Layers</th>
              <th>Tables</th>
              <th>Status</th>
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
