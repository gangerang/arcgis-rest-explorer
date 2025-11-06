import React, { useState, useMemo } from 'react';
import { Table, Form, Badge, Button, InputGroup } from 'react-bootstrap';
import { ArcGISResource } from '../types/arcgis.types';

interface ResourceTableProps {
  resources: ArcGISResource[];
  onResourceSelect: (resource: ArcGISResource) => void;
}

const ResourceTable: React.FC<ResourceTableProps> = ({ resources, onResourceSelect }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterGeometryType, setFilterGeometryType] = useState<string>('all');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get unique geometry types for filter
  const geometryTypes = useMemo(() => {
    const types = new Set(resources.map((r) => r.geometryType).filter((t) => t));
    return ['all', ...Array.from(types)];
  }, [resources]);

  // Sort handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filter and sort resources
  const filteredResources = useMemo(() => {
    let filtered = resources.filter((resource) => {
      const matchesSearch =
        resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (resource.folder && resource.folder.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (resource.description && resource.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = filterType === 'all' || resource.type === filterType;

      const matchesGeometryType =
        filterGeometryType === 'all' || resource.geometryType === filterGeometryType;

      return matchesSearch && matchesType && matchesGeometryType;
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
          case 'service':
            aVal = a.serviceName || '';
            bVal = b.serviceName || '';
            break;
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
          case 'type':
            aVal = a.type || '';
            bVal = b.type || '';
            break;
          case 'geometry':
            aVal = a.geometryType || '';
            bVal = b.geometryType || '';
            break;
          case 'fields':
            aVal = a.fieldCount || 0;
            bVal = b.fieldCount || 0;
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
  }, [resources, searchTerm, filterType, filterGeometryType, sortColumn, sortDirection]);

  const handleResourceClick = (resource: ArcGISResource) => {
    setSelectedResourceId(`${resource.serviceName}-${resource.id}`);
    onResourceSelect(resource);
  };

  const renderSortableHeader = (column: string, label: string) => (
    <th
      onClick={() => handleSort(column)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
      title={`Sort by ${label}`}
    >
      {label}
    </th>
  );

  const getTypeBadge = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'Layer': 'primary',
      'Table': 'info',
    };

    return <Badge bg={colorMap[type] || 'secondary'}>{type}</Badge>;
  };

  const formatLastUpdated = (lastEditDate?: number) => {
    if (!lastEditDate) return '-';

    try {
      const date = new Date(lastEditDate);
      // Check if date is valid
      if (isNaN(date.getTime())) return '-';

      // Format as date-only (YYYY-MM-DD)
      return date.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    } catch {
      return '-';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Resources ({filteredResources.length})</h3>
      </div>

      {/* Search and Filter */}
      <div className="mb-3 d-flex gap-2">
        <InputGroup style={{ flex: 2 }}>
          <InputGroup.Text>Search</InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search by resource name, service, folder, or description..."
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
          <option value="all">All Types</option>
          <option value="Layer">Layers</option>
          <option value="Table">Tables</option>
        </Form.Select>

        <Form.Select
          style={{ flex: 1 }}
          value={filterGeometryType}
          onChange={(e) => setFilterGeometryType(e.target.value)}
        >
          <option value="all">All Geometries</option>
          {geometryTypes.slice(1).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Form.Select>
      </div>

      {/* Resources Table */}
      <div>
        <Table striped bordered hover responsive size="sm">
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
            <tr>
              {renderSortableHeader('folder', 'Folder')}
              {renderSortableHeader('service', 'Service')}
              {renderSortableHeader('name', 'Resource Name')}
              {renderSortableHeader('type', 'Type')}
              {renderSortableHeader('geometry', 'Geometry')}
              {renderSortableHeader('fields', 'Fields')}
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredResources.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No resources found matching your criteria
                </td>
              </tr>
            ) : (
              filteredResources.map((resource, index) => (
                <tr
                  key={`${resource.serviceName}-${resource.id}-${index}`}
                  className={
                    selectedResourceId === `${resource.serviceName}-${resource.id}`
                      ? 'table-active'
                      : ''
                  }
                >
                  <td>
                    {resource.folder ? (
                      <a
                        href={`${resource.serviceUrl.split('/').slice(0, -1).join('/')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.9em' }}
                      >
                        {resource.folder}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <a
                        href={resource.serviceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.9em' }}
                      >
                        {resource.serviceName.split('/').pop()}
                      </a>
                      <small className="text-muted">{resource.serviceType}</small>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <a
                        href={resource.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {resource.name}
                      </a>
                      {resource.description && (
                        <small className="text-muted">{resource.description}</small>
                      )}
                      {resource.error && (
                        <small className="text-danger">{resource.error}</small>
                      )}
                    </div>
                  </td>
                  <td>{getTypeBadge(resource.type)}</td>
                  <td>
                    {resource.geometryType ? (
                      <Badge bg="secondary">{resource.geometryType}</Badge>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="text-center">
                    {resource.fieldCount !== undefined ? resource.fieldCount : '-'}
                  </td>
                  <td>
                    <small>{formatLastUpdated(resource.lastEditDate)}</small>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => handleResourceClick(resource)}
                      disabled={!!resource.error}
                    >
                      Query
                    </Button>
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
          Showing {filteredResources.length} of {resources.length} resources
        </small>
      </div>
    </div>
  );
};

export default ResourceTable;
