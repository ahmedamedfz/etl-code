export type ConfigFieldKind = 'text' | 'number' | 'file-path' | 'db-file-path';

export interface ConfigFieldMeta {
  label: string;
  kind: ConfigFieldKind;
  placeholder?: string;
  browseTitle?: string;
  fileExtensions?: string[];
}

const defaultMeta = (key: string): ConfigFieldMeta => ({
  label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
  kind: 'text',
});

const SOURCE_CSV_EXCEL: Record<string, ConfigFieldMeta> = {
  filePath: {
    label: 'CSV / Excel File',
    kind: 'file-path',
    placeholder: '/path/to/data.csv',
    browseTitle: 'Select data file',
    fileExtensions: ['csv', 'xlsx', 'xls'],
  },
  delimiter: { label: 'Delimiter', kind: 'text', placeholder: ',' },
  skipRows: { label: 'Skip Rows', kind: 'number' },
};

const SOURCE_SQLITE: Record<string, ConfigFieldMeta> = {
  connectionString: {
    label: 'SQLite Database File',
    kind: 'db-file-path',
    placeholder: '/path/to/database.sqlite',
    browseTitle: 'Select SQLite database',
    fileExtensions: ['sqlite', 'sqlite3', 'db'],
  },
  table: { label: 'Table Name', kind: 'text', placeholder: 'my_table' },
};

const SOURCE_SQL: Record<string, ConfigFieldMeta> = {
  connectionString: {
    label: 'Connection String',
    kind: 'text',
    placeholder: 'postgresql://user:pass@host:5432/db',
  },
  table: { label: 'Table Name', kind: 'text', placeholder: 'my_table' },
};

const SOURCE_REST: Record<string, ConfigFieldMeta> = {
  url: { label: 'Endpoint URL', kind: 'text', placeholder: 'https://api.example.com/data' },
  method: { label: 'HTTP Method', kind: 'text', placeholder: 'GET' },
};

export const getConfigFieldMeta = (
  nodeType: string,
  subType: string,
  key: string
): ConfigFieldMeta => {
  if (nodeType === 'source') {
    if (subType === 'csv' || subType === 'excel') {
      if (key === 'filePath' && subType === 'excel') {
        return {
          ...SOURCE_CSV_EXCEL.filePath,
          label: 'Excel File',
          fileExtensions: ['xlsx', 'xls'],
        };
      }
      if (SOURCE_CSV_EXCEL[key]) {
        return subType === 'csv' && key === 'filePath'
          ? { ...SOURCE_CSV_EXCEL.filePath, label: 'CSV File' }
          : SOURCE_CSV_EXCEL[key];
      }
    }
    if (subType === 'sqlite' && SOURCE_SQLITE[key]) {
      return SOURCE_SQLITE[key];
    }
    if ((subType === 'postgres' || subType === 'mysql') && SOURCE_SQL[key]) {
      return SOURCE_SQL[key];
    }
    if (subType === 'rest-api' && SOURCE_REST[key]) {
      return SOURCE_REST[key];
    }
  }

  if (nodeType === 'target' && subType === 'sqlite' && key === 'connectionString') {
    return SOURCE_SQLITE.connectionString;
  }

  return defaultMeta(key);
};

export const formatPathForDisplay = (filePath: string): { primary: string; secondary: string } => {
  const trimmed = filePath.trim();
  if (!trimmed) {
    return { primary: 'No file selected', secondary: '' };
  }

  const normalized = trimmed.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const fileName = segments[segments.length - 1] || trimmed;

  if (segments.length <= 1) {
    return { primary: fileName, secondary: trimmed };
  }

  const parent = segments[segments.length - 2];
  return {
    primary: fileName,
    secondary: parent ? `…/${parent}/${fileName}` : trimmed,
  };
};
