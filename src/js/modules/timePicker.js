// Custom time picker module
import { formatTimeFromMinutes, parseManualTime, getCurrentTimeMinutes } from '../utils/dateUtils.js';
import { showError } from '../utils/domUtils.js';
import { TIME_PICKER_CONFIG, SCHEDULE_CONFIG, TIME_OFFSETS } from '../constants.js';

class TimePicker {
    constructor(inputId, dropdownId, defaultOffsetMinutes = 0) {
        this.inputId = inputId;
        this.dropdownId = dropdownId;
        this.defaultOffsetMinutes = defaultOffsetMinutes;
        this.input = null;
        this.dropdown = null;
        this.timeOptions = [];
        this.selectedValue = null;
        this.isDropdownOpen = false;
        
        this.initialize();
    }

    initialize() {
        this.input = document.getElementById(this.inputId);
        this.dropdown = document.getElementById(this.dropdownId);
        
        if (!this.input || !this.dropdown) {
            return;
        }

        this.timeOptions = this.generateTimeOptions();
        this.setDefaultTime();
        this.setupEventListeners();
    }

    generateTimeOptions() {
        const options = [];
        for (let hour = SCHEDULE_CONFIG.START_HOUR; hour <= SCHEDULE_CONFIG.END_HOUR; hour++) {
            for (let minute = 0; minute < 60; minute += TIME_PICKER_CONFIG.INTERVAL_MINUTES) {
                const minutes = hour * 60 + minute;
                const timeText = formatTimeFromMinutes(minutes);
                options.push({
                    value: minutes,
                    text: timeText,
                    minutes: minutes
                });
            }
        }
        return options;
    }

    setDefaultTime() {
        const currentTime = getCurrentTimeMinutes() + this.defaultOffsetMinutes;
        const closestOption = this.findClosestTimeOption(currentTime);
        this.selectedValue = closestOption.value;
        this.input.value = closestOption.text;
        return closestOption;
    }

    findClosestTimeOption(targetMinutes) {
        let closest = this.timeOptions[0];
        let minDiff = Math.abs(targetMinutes - closest.minutes);
        
        for (let option of this.timeOptions) {
            const diff = Math.abs(targetMinutes - option.minutes);
            if (diff < minDiff) {
                minDiff = diff;
                closest = option;
            }
        }
        return closest;
    }

    populateDropdown() {
        this.dropdown.innerHTML = '';
        
        const currentTime = getCurrentTimeMinutes() + this.defaultOffsetMinutes;
        const closestOption = this.findClosestTimeOption(currentTime);
        
        this.timeOptions.forEach((option) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'time-option';
            optionDiv.textContent = option.text;
            optionDiv.dataset.value = option.value;
            
            if (this.selectedValue !== null && option.value === this.selectedValue) {
                optionDiv.classList.add('selected');
            }
            
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectTimeOption(option);
            });
            
            this.dropdown.appendChild(optionDiv);
        });
        
        // Scroll to selected or closest option
        setTimeout(() => {
            const selectedOption = this.dropdown.querySelector('.selected') ||
                                this.dropdown.querySelector(`[data-value="${closestOption.value}"]`);
            
            if (selectedOption) {
                const dropdownHeight = this.dropdown.clientHeight;
                const optionHeight = selectedOption.offsetHeight;
                const optionTop = selectedOption.offsetTop;
                const centerPosition = optionTop - (dropdownHeight / 2) + (optionHeight / 2);
                
                this.dropdown.scrollTop = Math.max(0, centerPosition);
            }
        }, 10);
    }

    selectTimeOption(option) {
        // Clear previous selections
        this.dropdown.querySelectorAll('.time-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.classList.remove('current-time');
        });
        
        // Select new option
        const optionDiv = this.dropdown.querySelector(`[data-value="${option.value}"]`);
        if (optionDiv) {
            optionDiv.classList.add('selected');
        }
        
        this.selectedValue = option.value;
        this.input.value = option.text;
        this.hideDropdown();
    }

    showDropdown() {
        // Hide all other dropdowns first
        document.querySelectorAll('.time-dropdown').forEach(dd => {
            dd.classList.remove('show');
        });
        
        this.populateDropdown();
        this.dropdown.classList.add('show');
        this.isDropdownOpen = true;
    }

    hideDropdown() {
        this.dropdown.classList.remove('show');
        this.isDropdownOpen = false;
    }

    validateAndUpdateTime() {
        const inputValue = this.input.value.trim();
        if (inputValue) {
            try {
                const parsedTime = parseManualTime(inputValue);
                this.selectedValue = parsedTime;
                this.input.value = formatTimeFromMinutes(parsedTime);
                
                // Update selected option in dropdown if it's open
                if (this.isDropdownOpen) {
                    this.dropdown.querySelectorAll('.time-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    const matchingOption = this.dropdown.querySelector(`[data-value="${parsedTime}"]`);
                    if (matchingOption) {
                        matchingOption.classList.add('selected');
                    }
                }
            } catch (error) {
                showError(error.message);
                // Revert to previous valid value or default
                if (this.selectedValue !== null) {
                    this.input.value = formatTimeFromMinutes(this.selectedValue);
                } else {
                    this.setDefaultTime();
                }
            }
        }
    }

    setupEventListeners() {
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isDropdownOpen) {
                this.showDropdown();
            }
        });

        this.input.addEventListener('focus', (e) => {
            setTimeout(() => {
                e.target.select();
            }, 10);
        });

        this.input.addEventListener('input', (e) => {
            const inputValue = e.target.value;
            
            const matchingOption = this.timeOptions.find(opt => 
                opt.text.toLowerCase().startsWith(inputValue.toLowerCase())
            );
            
            if (matchingOption && this.isDropdownOpen) {
                this.dropdown.querySelectorAll('.time-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                const optionDiv = this.dropdown.querySelector(`[data-value="${matchingOption.value}"]`);
                if (optionDiv) {
                    optionDiv.classList.add('selected');
                    optionDiv.scrollIntoView({ block: 'nearest' });
                }
            }
        });

        this.input.addEventListener('blur', () => {
            setTimeout(() => {
                this.validateAndUpdateTime();
                this.hideDropdown();
            }, 150);
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.validateAndUpdateTime();
                this.hideDropdown();
                this.input.blur();
            } else if (e.key === 'Escape') {
                this.hideDropdown();
                this.input.blur();
            } else if (e.key === 'ArrowDown' && this.isDropdownOpen) {
                e.preventDefault();
                this.navigateDropdown('next');
            } else if (e.key === 'ArrowUp' && this.isDropdownOpen) {
                e.preventDefault();
                this.navigateDropdown('prev');
            }
        });
    }

    navigateDropdown(direction) {
        const selected = this.dropdown.querySelector('.selected');
        let target;
        
        if (direction === 'next') {
            target = selected ? selected.nextElementSibling : this.dropdown.firstElementChild;
        } else {
            target = selected ? selected.previousElementSibling : this.dropdown.lastElementChild;
        }
        
        if (target && target.classList.contains('time-option')) {
            const option = this.timeOptions.find(opt => opt.value == target.dataset.value);
            if (option) {
                this.selectTimeOption(option);
            }
        }
    }

    // Public API methods
    getValue() {
        return this.selectedValue;
    }

    setValue(minutes) {
        const option = this.timeOptions.find(opt => opt.value === minutes);
        if (option) {
            this.selectedValue = option.value;
            this.input.value = option.text;
        }
    }

    getValueAsString() {
        return this.input.value;
    }

    isValid() {
        if (this.selectedValue !== null) return true;
        try {
            parseManualTime(this.input.value);
            return true;
        } catch {
            return false;
        }
    }

    reset() {
        this.setDefaultTime();
    }
}

// Static method to close all dropdowns when clicking outside
function closeAllDropdowns() {
    document.querySelectorAll('.time-dropdown').forEach(dropdown => {
        dropdown.classList.remove('show');
    });
}

// Global click handler
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-time-input')) {
        closeAllDropdowns();
    }
});

export function createTimePicker(inputId, dropdownId, defaultOffsetMinutes = 0) {
    return new TimePicker(inputId, dropdownId, defaultOffsetMinutes);
}

export function initializeDefaultTimePickers() {
    const startTimePicker = createTimePicker('task-start-time', 'start-time-dropdown', TIME_OFFSETS.START_TIME_DEFAULT);
    const endTimePicker = createTimePicker('task-end-time', 'end-time-dropdown', TIME_OFFSETS.END_TIME_DEFAULT);
    
    return { startTimePicker, endTimePicker };
}