import { csrfSync } from 'csrf-sync';

const csrf = csrfSync();

export const generateCsrfToken = csrf.generateToken;
export const csrfProtection = csrf.csrfSynchronisedProtection;
