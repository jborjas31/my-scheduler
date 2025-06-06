// DOM manipulation utilities
import { UI_CONFIG } from '../constants.js';

export function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorTextSpan = document.getElementById('error-text');
    if (errorDiv && errorTextSpan) {
        errorTextSpan.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, UI_CONFIG.ERROR_DISPLAY_DURATION);
    } else {
        alert('Error: ' + message);
    }
}

export function showSuccess(message) {
    const existingSuccess = document.getElementById('success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    const successDiv = document.createElement('div');
    successDiv.id = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #d4edda;
        color: #155724;
        padding: 12px 20px;
        border-radius: 4px;
        border: 1px solid #c3e6cb;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 350px;
        font-weight: 500;
        font-size: 14px;
    `;
    successDiv.innerHTML = `<strong>✓</strong> ${message}`;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, UI_CONFIG.SUCCESS_DISPLAY_DURATION);
}

export function setLoadingState(isLoading) {
    const container = document.querySelector('.schedule-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    if (container) {
        if (isLoading) {
            container.classList.add('loading');
            if (loadingIndicator) loadingIndicator.style.display = 'block';
        } else {
            container.classList.remove('loading');
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }
}

export function escapeHtml(text) {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeJsString(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export function getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

export function querySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Element with selector '${selector}' not found`);
    }
    return element;
}

export function querySelectorAll(selector) {
    return document.querySelectorAll(selector);
}

export function createElement(tagName, className = '', textContent = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

export function removeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 150);
    }
}