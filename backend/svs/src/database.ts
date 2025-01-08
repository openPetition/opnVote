import { DataSource } from 'typeorm';
import {ormConfig} from './ormconfig';

const appDataSource = new DataSource(ormConfig as any);
export const dataSource = appDataSource;
