// ArcGIS REST API Type Definitions

export interface ArcGISCatalogResponse {
  services: ArcGISServiceInfo[];
  folders: string[];
  currentVersion?: number;
}

export interface ArcGISServiceInfo {
  name: string;
  type: string;
}

export interface ArcGISService {
  name: string;
  type: string;
  url: string;
  folder?: string;
  layerCount?: number;
  tableCount?: number;
  requiresAuth: boolean;
  isEmpty: boolean;
  error?: string;
  serviceDescription?: string;
  description?: string;
  capabilities?: string;
  layers?: ArcGISLayer[];
  tables?: ArcGISTable[];
  responseTime?: number;
}

export interface ArcGISLayer {
  id: number;
  name: string;
  parentLayerId?: number;
  defaultVisibility?: boolean;
  subLayerIds?: number[] | null;
  minScale?: number;
  maxScale?: number;
  type?: string;
  geometryType?: string;
}

export interface ArcGISTable {
  id: number;
  name: string;
}

export interface ArcGISLayerDetails {
  id: number;
  name: string;
  type: string;
  geometryType?: string;
  description?: string;
  fields?: ArcGISField[];
  extent?: ArcGISExtent;
  capabilities?: string;
}

export interface ArcGISField {
  name: string;
  type: string;
  alias?: string;
  length?: number;
  editable?: boolean;
  nullable?: boolean;
  domain?: any;
}

export interface ArcGISExtent {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference?: {
    wkid?: number;
    latestWkid?: number;
  };
}

export interface ArcGISQueryResponse {
  features: ArcGISFeature[];
  fields?: ArcGISField[];
  geometryType?: string;
  spatialReference?: any;
  exceededTransferLimit?: boolean;
}

export interface ArcGISFeature {
  attributes: { [key: string]: any };
  geometry?: any;
}

export interface ServiceStatus {
  accessible: boolean;
  requiresAuth: boolean;
  isEmpty: boolean;
  redirected: boolean;
  error?: string;
  responseTime?: number;
}

export interface QueryOptions {
  where?: string;
  outFields?: string;
  returnGeometry?: boolean;
  resultRecordCount?: number;
  f?: string;
}

export interface ArcGISResource {
  id: number;
  name: string;
  type: 'Layer' | 'Table';
  serviceName: string;
  serviceType: string;
  serviceUrl: string;
  resourceUrl: string;
  folder?: string;
  geometryType?: string;
  fieldCount?: number;
  fields?: ArcGISField[];
  description?: string;
  editFieldsInfo?: {
    creationDateField?: string;
    creatorField?: string;
    editDateField?: string;
    editorField?: string;
  };
  hasTimestamp?: boolean;
  requiresAuth: boolean;
  error?: string;
}
