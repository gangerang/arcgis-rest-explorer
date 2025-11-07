import React, { useState, useMemo } from 'react';
import { Table, Form, InputGroup, Button, Badge } from 'react-bootstrap';
import { ArcGISResource, ArcGISField } from '../types/arcgis.types';
import { Search, XCircle } from 'react-bootstrap-icons';

interface ResourceFieldTableProps {
  resources: ArcGISResource[];
  onQueryClick?: (resource: ArcGISResource) => void;
}

interface ExpandedFieldRow {
  resource: ArcGISResource;
  field: ArcGISField;
}

export const ResourceFieldTable: React.FC<ResourceFieldTableProps> = ({
  resources,
  onQueryClick,
}) => {
  const [resourceSearchTerm, setResourceSearchTerm] = useState<string>('');
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>('');

  // Flatten resources into field-level rows
  const allFieldRows = useMemo<ExpandedFieldRow[]>(() => {
    const rows: ExpandedFieldRow[] = [];
    resources.forEach(resource => {
      if (resource.fields && resource.fields.length > 0) {
        resource.fields.forEach(field => {
          rows.push({ resource, field });
        });
      } else {
        // Include resources without fields (show as single row)
        rows.push({ resource, field: { name: '', type: '' } as ArcGISField });
      }
    });
    return rows;
  }, [resources]);

  // Filter by both resource name and field name
  const filteredRows = useMemo(() => {
    return allFieldRows.filter(row => {
      // Filter by resource name (searches across name, service, folder)
      const resourceMatch = !resourceSearchTerm ||
        row.resource.name.toLowerCase().includes(resourceSearchTerm.toLowerCase()) ||
        row.resource.serviceName.toLowerCase().includes(resourceSearchTerm.toLowerCase()) ||
        (row.resource.folder || '').toLowerCase().includes(resourceSearchTerm.toLowerCase());

      // Filter by field name (searches field name and alias)
      const fieldMatch = !fieldSearchTerm ||
        row.field.name.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
        (row.field.alias || '').toLowerCase().includes(fieldSearchTerm.toLowerCase());

      return resourceMatch && fieldMatch;
    });
  }, [allFieldRows, resourceSearchTerm, fieldSearchTerm]);

  // Group filtered rows by resource for display
  const groupedRows = useMemo(() => {
    const groups = new Map<string, ExpandedFieldRow[]>();
    filteredRows.forEach(row => {
      const key = `${row.resource.serviceUrl}-${row.resource.id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });
    return groups;
  }, [filteredRows]);

  const handleClearResourceSearch = () => setResourceSearchTerm('');
  const handleClearFieldSearch = () => setFieldSearchTerm('');

  const formatFieldType = (type: string): string => {
    // Simplify common field types for display
    const typeMap: Record<string, string> = {
      'esriFieldTypeString': 'String',
      'esriFieldTypeInteger': 'Integer',
      'esriFieldTypeSmallInteger': 'SmallInt',
      'esriFieldTypeDouble': 'Double',
      'esriFieldTypeSingle': 'Single',
      'esriFieldTypeDate': 'Date',
      'esriFieldTypeOID': 'OID',
      'esriFieldTypeGeometry': 'Geometry',
      'esriFieldTypeGlobalID': 'GlobalID',
      'esriFieldTypeGUID': 'GUID',
    };
    return typeMap[type] || type;
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

  return (
    <div>
      <div className="mb-3">
        <div className="d-flex gap-2 flex-column flex-md-row">
          {/* Resource Name Filter */}
          <InputGroup style={{ maxWidth: '400px' }}>
            <InputGroup.Text>
              <Search size={16} />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Filter by resource name..."
              value={resourceSearchTerm}
              onChange={(e) => setResourceSearchTerm(e.target.value)}
            />
            {resourceSearchTerm && (
              <Button
                variant="outline-secondary"
                onClick={handleClearResourceSearch}
                style={{ borderLeft: 'none' }}
              >
                <XCircle size={16} />
              </Button>
            )}
          </InputGroup>

          {/* Field Name Filter */}
          <InputGroup style={{ maxWidth: '400px' }}>
            <InputGroup.Text>
              <Search size={16} />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Filter by field name..."
              value={fieldSearchTerm}
              onChange={(e) => setFieldSearchTerm(e.target.value)}
            />
            {fieldSearchTerm && (
              <Button
                variant="outline-secondary"
                onClick={handleClearFieldSearch}
                style={{ borderLeft: 'none' }}
              >
                <XCircle size={16} />
              </Button>
            )}
          </InputGroup>
        </div>

        <div className="mt-2 text-muted small">
          Showing {filteredRows.length} field{filteredRows.length !== 1 ? 's' : ''}
          {' '}from {groupedRows.size} resource{groupedRows.size !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="table-responsive">
        <Table striped bordered hover size="sm">
          <thead className="table-light">
            <tr>
              <th style={{ width: '10%' }}>Service</th>
              <th style={{ width: '15%' }}>Resource</th>
              <th style={{ width: '8%' }}>Type</th>
              <th style={{ width: '15%' }}>Field Name</th>
              <th style={{ width: '15%' }}>Field Alias</th>
              <th style={{ width: '10%' }}>Field Type</th>
              <th style={{ width: '7%' }}>Length</th>
              <th style={{ width: '7%' }}>Nullable</th>
              <th style={{ width: '7%' }}>Editable</th>
              <th style={{ width: '6%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted py-4">
                  No fields found matching the filter criteria
                </td>
              </tr>
            ) : (
              Array.from(groupedRows.entries()).map(([key, rows]) => {
                const resource = rows[0].resource;
                return rows.map((row, fieldIndex) => {
                  const isFirstFieldInGroup = fieldIndex === 0;
                  const rowSpan = rows.length;

                  return (
                    <tr key={`${key}-${fieldIndex}`}>
                      {/* Resource columns - only show for first field */}
                      {isFirstFieldInGroup && (
                        <>
                          <td rowSpan={rowSpan}>
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
                          <td rowSpan={rowSpan}>
                            <div className="d-flex flex-column">
                              <a
                                href={resource.resourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none', color: 'inherit' }}
                              >
                                {resource.name}
                              </a>
                              {resource.folder && (
                                <small className="text-muted">{resource.folder}</small>
                              )}
                            </div>
                          </td>
                          <td rowSpan={rowSpan}>
                            <div className="d-flex align-items-center gap-1">
                              <Badge bg={resource.type === 'Layer' ? 'primary' : 'info'}>
                                {resource.type}
                              </Badge>
                              {resource.geometryType && (
                                <span title={resource.geometryType}>{getGeometryEmoji(resource.geometryType)}</span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Field columns */}
                      {row.field.name ? (
                        <>
                          <td>
                            <code className="small">{row.field.name}</code>
                          </td>
                          <td>
                            {row.field.alias && row.field.alias !== row.field.name ? (
                              <span>{row.field.alias}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <Badge bg="light" text="dark">
                              {formatFieldType(row.field.type)}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {row.field.length !== undefined ? (
                              <span>{row.field.length}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {row.field.nullable !== undefined ? (
                              <Badge bg={row.field.nullable ? 'warning' : 'success'} className="small">
                                {row.field.nullable ? 'Yes' : 'No'}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {row.field.editable !== undefined ? (
                              <Badge bg={row.field.editable ? 'success' : 'secondary'} className="small">
                                {row.field.editable ? 'Yes' : 'No'}
                              </Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={6} className="text-center text-muted">
                            No fields available
                          </td>
                        </>
                      )}

                      {/* Actions column - only show for first field */}
                      {isFirstFieldInGroup && (
                        <td rowSpan={rowSpan} className="text-center">
                          {onQueryClick && resource.type === 'Layer' && !resource.error && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => onQueryClick(resource)}
                            >
                              Query
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default ResourceFieldTable;
