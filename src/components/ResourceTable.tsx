import React, { useState, useMemo } from 'react';
import { Table, Form, Badge, Button, InputGroup, Spinner } from 'react-bootstrap';
import { ArcGISResource } from '../types/arcgis.types';
import { ArcGISServiceClient } from '../services/arcgisService';
import { AuthService } from '../services/authService';

interface ResourceTableProps {
  resources: ArcGISResource[];
  onResourceSelect: (resource: ArcGISResource) => void;
}

const ResourceTable: React.FC<ResourceTableProps> = ({ resources, onResourceSelect }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [recordCounts, setRecordCounts] = useState<Map<string, number>>(new Map());
  const [loadingCounts, setLoadingCounts] = useState<Set<string>>(new Set());

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

      return matchesSearch && matchesType;
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
          case 'fields':
            aVal = a.fieldCount || 0;
            bVal = b.fieldCount || 0;
            break;
          case 'lastUpdated':
            aVal = a.lastEditDate || 0;
            bVal = b.lastEditDate || 0;
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
  }, [resources, searchTerm, filterType, sortColumn, sortDirection]);

  const handleResourceClick = (resource: ArcGISResource) => {
    setSelectedResourceId(`${resource.serviceName}-${resource.id}`);
    onResourceSelect(resource);
  };

  const getGeometryEmoji = (geometryType?: string): string => {
    if (!geometryType) return '';

    const geometryMap: { [key: string]: string } = {
      'esriGeometryPoint': '📍',
      'Point': '📍',
      'esriGeometryPolyline': '━',
      'Polyline': '━',
      'esriGeometryPolygon': '⬜',
      'Polygon': '⬜',
      'esriGeometryMultipoint': '📍📍',
      'Multipoint': '📍📍',
      'esriGeometryEnvelope': '📦',
      'Envelope': '📦',
    };

    return geometryMap[geometryType] || '';
  };

  const handleGetRecordCount = async (resource: ArcGISResource) => {
    const resourceKey = `${resource.serviceName}-${resource.id}`;

    // Don't fetch if already loading
    if (loadingCounts.has(resourceKey)) {
      return;
    }

    // Mark as loading
    setLoadingCounts(prev => new Set(prev).add(resourceKey));

    try {
      const count = await ArcGISServiceClient.getRecordCount(
        resource.serviceUrl,
        resource.id,
        true
      );

      // Update record counts
      setRecordCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(resourceKey, count);
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching record count:', error);
      // Set error state by using -1 to indicate error
      setRecordCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(resourceKey, -1);
        return newMap;
      });
    } finally {
      // Remove from loading
      setLoadingCounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(resourceKey);
        return newSet;
      });
    }
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
    <div className="resource-table-mobile">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Resources ({filteredResources.length})</h3>
      </div>

      {/* Search and Filter */}
      <div className="mb-3 d-flex gap-2 mobile-stack-filters">
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
      </div>

      {/* Resources Table */}
      <div className="table-responsive">
        <Table striped bordered hover size="sm">
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
            <tr>
              {renderSortableHeader('folder', 'Folder')}
              {renderSortableHeader('service', 'Service')}
              {renderSortableHeader('name', 'Resource Name')}
              {renderSortableHeader('type', 'Type')}
              {renderSortableHeader('fields', 'Fields')}
              <th>Record Count</th>
              {renderSortableHeader('lastUpdated', 'Last Updated')}
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
                        href={addTokenToUrl(`${resource.serviceUrl.split('/').slice(0, -1).join('/')}`)}
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
                        href={addTokenToUrl(resource.serviceUrl)}
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
                        href={addTokenToUrl(resource.resourceUrl)}
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
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      {getTypeBadge(resource.type)}
                      {resource.geometryType && (
                        <span title={resource.geometryType}>{getGeometryEmoji(resource.geometryType)}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    {resource.fieldCount !== undefined ? resource.fieldCount : '-'}
                  </td>
                  <td className="text-center">
                    {(() => {
                      const resourceKey = `${resource.serviceName}-${resource.id}`;
                      const count = recordCounts.get(resourceKey);
                      const isLoading = loadingCounts.has(resourceKey);

                      if (isLoading) {
                        return <Spinner animation="border" size="sm" />;
                      } else if (count !== undefined) {
                        return count === -1 ? (
                          <span className="text-danger">Error</span>
                        ) : (
                          <span>{count.toLocaleString()}</span>
                        );
                      } else {
                        return (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => handleGetRecordCount(resource)}
                            disabled={!!resource.error}
                          >
                            Count
                          </Button>
                        );
                      }
                    })()}
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
