#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file or process.env (for Netlify)
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    let env = {};
    
    // Try to load from .env file first (for local development)
    if (fs.existsSync(envPath)) {
        console.log('📁 Loading environment variables from .env file');
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        envContent.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value.length) {
                env[key.trim()] = value.join('=').trim();
            }
        });
    } else {
        console.log('🌐 Loading environment variables from process.env (production)');
        // Load from process.env (Netlify, etc.)
        env = {
            FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
            FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
            FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
            FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
            FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
            FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
            FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
            FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID,
            GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
        };
    }
    
    // Validate required environment variables
    const required = [
        'FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_DATABASE_URL',
        'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID',
        'FIREBASE_APP_ID', 'FIREBASE_MEASUREMENT_ID', 'GOOGLE_MAPS_API_KEY'
    ];
    
    const missing = required.filter(key => !env[key]);
    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('💡 Set these in Netlify Site Settings → Environment Variables');
        process.exit(1);
    }
    
    console.log('✅ All required environment variables loaded');
    return env;
}

// Replace placeholders in files
function replacePlaceholders(filePath, env) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace environment variable placeholders
    Object.keys(env).forEach(key => {
        const placeholder = `%%${key}%%`;
        content = content.replace(new RegExp(placeholder, 'g'), env[key]);
    });
    
    return content;
}

// Build the application
function build() {
    const env = loadEnv();
    const distDir = path.join(__dirname, 'dist');
    
    // Create dist directory
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
    }
    
    // Copy and process HTML file
    const htmlContent = replacePlaceholders('index.html', env);
    fs.writeFileSync(path.join(distDir, 'index.html'), htmlContent);
    
    // Copy and process JS file
    const jsContent = replacePlaceholders('script.js', env);
    fs.writeFileSync(path.join(distDir, 'script.js'), jsContent);
    
    // Copy CSS file (no processing needed)
    fs.copyFileSync('styles.css', path.join(distDir, 'styles.css'));
    
    // Copy other assets
    const assetsToCopy = ['spainflag.png'];
    assetsToCopy.forEach(asset => {
        if (fs.existsSync(asset)) {
            fs.copyFileSync(asset, path.join(distDir, asset));
            console.log(`✓ Copied ${asset}`);
        } else {
            console.warn(`⚠️  Asset not found: ${asset}`);
        }
    });
    
    console.log('✅ Build complete! Files are in the dist/ directory.');
    console.log('🚀 Run: cd dist && python3 -m http.server 8000');
}

build();