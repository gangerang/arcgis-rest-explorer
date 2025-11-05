# ArcGIS REST Service Explorer

A React-based web application for exploring and querying ArcGIS REST service endpoints.

## Features

- **Service Discovery**: Automatically discover all services, folders, and tables from an ArcGIS REST endpoint
- **Service Table**: Display services in a sortable, searchable table with:
  - Folder paths
  - Service names and types
  - Layer and table counts
  - Authentication status indicators
- **Layer Querying**: Query any layer or table with:
  - Custom WHERE clauses (default: `1=1` for all records)
  - Optional geometry inclusion
  - Configurable result limits
  - Export results as CSV or JSON
- **Authentication Detection**: Automatically detects services that require authentication or redirect to login pages
- **Empty Folder Detection**: Identifies folders with no services

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

Dependencies are already installed. If you need to reinstall:
```bash
npm install
```

### Running the Application

Start the development server:
```bash
npm start
```

The application will open in your browser at `http://localhost:3000`

### Building for Production

Create a production build:
```bash
npm run build
```

## Usage

1. Enter an ArcGIS REST service URL in the input field (e.g., `https://mapservices.randwick.nsw.gov.au/arcgis/rest/services`)
2. Click "Explore" to fetch all services
3. Use the search and filter controls to find specific services
4. Click "Query" on any service with layers to open the query interface
5. Select a layer, configure query parameters, and execute the query
6. Export results as CSV or JSON

## Technology Stack

- React with TypeScript
- Bootstrap & React-Bootstrap for UI
- Axios for HTTP requests
- ArcGIS REST API

## Project Structure

```
src/
├── components/
│   ├── ServiceExplorer.tsx    # Main component
│   ├── ServiceTable.tsx        # Service listing with search/filter
│   └── LayerQuery.tsx          # Layer query interface
├── services/
│   └── arcgisService.ts        # ArcGIS REST API client
├── types/
│   └── arcgis.types.ts         # TypeScript interfaces
└── App.tsx                     # Root component
```

## License

MIT
