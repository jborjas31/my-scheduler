// Floating banner module
import { UI_CONFIG } from '../constants.js';

class FloatingBannerController {
    constructor() {
        this.floatingBanner = null;
        this.isVisible = false;
        this.scrollTimeout = null;
        
        this.initialize();
    }

    initialize() {
        this.floatingBanner = document.getElementById('floating-banner');
        
        if (!this.floatingBanner) {
            console.warn('Floating banner element not found');
            return;
        }
        
        this.setupEventListeners();
        this.toggleFloatingBanner(); // Initial check
    }

    setupEventListeners() {
        // Throttled scroll handler for better performance
        window.addEventListener('scroll', () => {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = setTimeout(() => this.toggleFloatingBanner(), 10);
        });
        
        // Setup floating banner navigation buttons
        this.setupFloatingBannerButtons();
    }

    toggleFloatingBanner() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldShow = scrollTop > UI_CONFIG.FLOATING_BANNER_THRESHOLD;
        
        if (shouldShow && !this.isVisible) {
            this.floatingBanner.classList.add('show');
            document.body.classList.add('floating-banner-visible');
            this.isVisible = true;
            this.updateFloatingBannerContent();
        } else if (!shouldShow && this.isVisible) {
            this.floatingBanner.classList.remove('show');
            document.body.classList.remove('floating-banner-visible');
            this.isVisible = false;
        }
    }

    updateFloatingBannerContent() {
        // Update date displays
        const mainDateDisplay = document.getElementById('current-date-display');
        const floatingDateDisplayDesktop = document.getElementById('floating-current-date-display');
        const floatingDateDisplayMobile = document.getElementById('floating-current-date-display-mobile');
        
        if (mainDateDisplay) {
            const dateText = mainDateDisplay.textContent;
            if (floatingDateDisplayDesktop) floatingDateDisplayDesktop.textContent = dateText;
            if (floatingDateDisplayMobile) floatingDateDisplayMobile.textContent = dateText;
        }
        
        // Update time displays
        const mainTimeDisplay = document.getElementById('current-time-display');
        const floatingTimeDisplayDesktop = document.getElementById('floating-current-time-display');
        const floatingTimeDisplayMobile = document.getElementById('floating-current-time-display-mobile');
        
        if (mainTimeDisplay) {
            const timeText = mainTimeDisplay.textContent;
            if (floatingTimeDisplayDesktop) floatingTimeDisplayDesktop.textContent = timeText;
            if (floatingTimeDisplayMobile) floatingTimeDisplayMobile.textContent = timeText;
        }
        
        // Update date pickers
        const mainDatePicker = document.getElementById('date-picker');
        const floatingDatePickerDesktop = document.getElementById('floating-date-picker');
        const floatingDatePickerMobile = document.getElementById('floating-date-picker-mobile');
        
        if (mainDatePicker) {
            const pickerValue = mainDatePicker.value;
            if (floatingDatePickerDesktop) floatingDatePickerDesktop.value = pickerValue;
            if (floatingDatePickerMobile) floatingDatePickerMobile.value = pickerValue;
        }
    }

    setupFloatingBannerButtons() {
        // Desktop buttons
        const floatingPrevBtn = document.getElementById('floating-prev-day-btn');
        const floatingNextBtn = document.getElementById('floating-next-day-btn');
        const floatingTodayBtn = document.getElementById('floating-today-btn');
        const floatingDatePicker = document.getElementById('floating-date-picker');
        
        // Mobile buttons
        const floatingPrevBtnMobile = document.getElementById('floating-prev-day-btn-mobile');
        const floatingNextBtnMobile = document.getElementById('floating-next-day-btn-mobile');
        const floatingTodayBtnMobile = document.getElementById('floating-today-btn-mobile');
        const floatingDatePickerMobile = document.getElementById('floating-date-picker-mobile');
        
        // Desktop event listeners
        if (floatingPrevBtn) {
            floatingPrevBtn.addEventListener('click', () => {
                this.triggerMainNavigation('prev');
            });
        }
        
        if (floatingNextBtn) {
            floatingNextBtn.addEventListener('click', () => {
                this.triggerMainNavigation('next');
            });
        }
        
        if (floatingTodayBtn) {
            floatingTodayBtn.addEventListener('click', () => {
                this.triggerMainNavigation('today');
            });
        }
        
        if (floatingDatePicker) {
            floatingDatePicker.addEventListener('change', (e) => {
                this.triggerMainDatePicker(e.target.value);
            });
        }
        
        // Mobile event listeners (same functionality)
        if (floatingPrevBtnMobile) {
            floatingPrevBtnMobile.addEventListener('click', () => {
                this.triggerMainNavigation('prev');
            });
        }
        
        if (floatingNextBtnMobile) {
            floatingNextBtnMobile.addEventListener('click', () => {
                this.triggerMainNavigation('next');
            });
        }
        
        if (floatingTodayBtnMobile) {
            floatingTodayBtnMobile.addEventListener('click', () => {
                this.triggerMainNavigation('today');
            });
        }
        
        if (floatingDatePickerMobile) {
            floatingDatePickerMobile.addEventListener('change', (e) => {
                this.triggerMainDatePicker(e.target.value);
            });
        }
    }

    triggerMainNavigation(action) {
        let button = null;
        
        switch (action) {
            case 'prev':
                button = document.getElementById('prev-day-btn');
                break;
            case 'next':
                button = document.getElementById('next-day-btn');
                break;
            case 'today':
                button = document.getElementById('today-btn');
                break;
        }
        
        if (button) {
            button.click();
            setTimeout(() => this.sync(), 100);
        }
    }

    triggerMainDatePicker(value) {
        const mainDatePicker = document.getElementById('date-picker');
        if (mainDatePicker) {
            mainDatePicker.value = value;
            mainDatePicker.dispatchEvent(new Event('change'));
            setTimeout(() => this.sync(), 100);
        }
    }

    // Public API
    sync() {
        if (this.isVisible) {
            this.updateFloatingBannerContent();
        }
    }

    show() {
        if (!this.isVisible) {
            this.floatingBanner.classList.add('show');
            document.body.classList.add('floating-banner-visible');
            this.isVisible = true;
            this.updateFloatingBannerContent();
        }
    }

    hide() {
        if (this.isVisible) {
            this.floatingBanner.classList.remove('show');
            document.body.classList.remove('floating-banner-visible');
            this.isVisible = false;
        }
    }

    isFloatingBannerVisible() {
        return this.isVisible;
    }
}

export function initializeFloatingBanner() {
    return new FloatingBannerController();
}