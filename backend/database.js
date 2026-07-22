import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db.json');

const defaultData = {
  users: [],
  jobs: [],
  applications: [],
  attendance: [],
  notifications: [],
  reviews: [],
  leaves: []
};

export const getDb = () => {
    try {
        if (!fs.existsSync(dbPath)) {
            saveDb(defaultData);
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.error("DB reading error. Resetting to default data.", e);
        return defaultData;
    }
}

export const saveDb = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Generate unique IDs
export const generateId = () => Math.random().toString(36).substr(2, 9);
