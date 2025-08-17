#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env file not found. Copy .env.example to .env and fill in your API keys.');
        process.exit(1);
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length) {
            env[key.trim()] = value.join('=').trim();
        }
    });
    
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
    if (fs.existsSync('spainflag.png')) {
        fs.copyFileSync('spainflag.png', path.join(distDir, 'spainflag.png'));
    }
    
    console.log('✅ Build complete! Files are in the dist/ directory.');
    console.log('🚀 Run: cd dist && python3 -m http.server 8000');
}

build();