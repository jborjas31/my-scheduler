// Date and time utility functions

export function formatDateDisplay(date) {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
}

export function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatTimeFromMinutes(minutes) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    
    if (hour === 0 && min === 0) return '12:00 AM';
    if (hour < 12) {
        return `${hour === 0 ? 12 : hour}:${min.toString().padStart(2, '0')} AM`;
    } else if (hour === 12) {
        return `12:${min.toString().padStart(2, '0')} PM`;
    } else {
        return `${hour - 12}:${min.toString().padStart(2, '0')} PM`;
    }
}

export function formatTimeRange(startMinutes, endMinutes) {
    const startTime = formatTimeFromMinutes(startMinutes);
    const endTime = formatTimeFromMinutes(endMinutes);
    
    if (endMinutes <= startMinutes) {
        return `${startTime} - ${endTime} (+1 day)`;
    } else {
        return `${startTime} - ${endTime}`;
    }
}

export function formatHour(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

export function getCurrentTimeMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

export function parseManualTime(timeString) {
    if (!timeString || timeString.trim() === '') return null;
    
    const cleanTime = timeString.trim();
    
    // Handle 24-hour format
    const time24Match = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
    if (time24Match) {
        const hour = parseInt(time24Match[1]);
        const minute = parseInt(time24Match[2]);
        
        if (hour < 0 || hour > 23) {
            throw new Error(`Invalid hour: ${hour}. Use 0-23 for 24-hour format.`);
        }
        if (minute < 0 || minute > 59) {
            throw new Error(`Invalid minute: ${minute}. Use 0-59.`);
        }
        
        return hour * 60 + minute;
    }
    
    // Handle 12-hour format
    const time12Match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
        let hour = parseInt(time12Match[1]);
        const minute = parseInt(time12Match[2]);
        const period = time12Match[3].toUpperCase();
        
        if (hour < 1 || hour > 12) {
            throw new Error(`Invalid hour: ${hour}. Use 1-12 for AM/PM format.`);
        }
        if (minute < 0 || minute > 59) {
            throw new Error(`Invalid minute: ${minute}. Use 0-59.`);
        }
        
        if (hour === 12) hour = 0;
        if (period === 'PM') hour += 12;
        
        return hour * 60 + minute;
    }
    
    throw new Error(`Time format not recognized: "${cleanTime}". Use formats like "2:30 PM" or "14:30"`);
}

export function isToday(date) {
    const today = new Date();
    return getDateString(date) === getDateString(today);
}

export function isDateInRange(date, daysFromToday = 365) {
    const today = new Date();
    const pastLimit = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const futureLimit = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    
    return date >= pastLimit && date <= futureLimit;
}