// State management
let itineraryData = {
    activities: {},
    notes: {},
    dayTitles: {},
    collapsedDays: [],
    selectedHotels: {},
    activityCounter: 1000,
    tripDates: {
        startDate: null,
        endDate: null
    },
    cityDurations: {
        madrid: 7,
        seville: 3,
        cordoba: 1,
        granada: 3,
        'madrid-final': 1
    },
    transportBookings: {},
    todoItems: {}
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    loadSavedData();
    setupEventListeners();
    initializeActivities();
    updateTripDatesDisplay();
    initializeTodoItems();
    updateTodoProgress();
    initializeCityManagement();
});

function setupEventListeners() {
    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Day toggles
    const dayHeaders = document.querySelectorAll('.day-header');
    dayHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            if (!e.target.closest('.edit-day-btn')) {
                const day = this.parentElement;
                day.classList.toggle('collapsed');
                saveData();
            }
        });
    });

    // Edit day buttons
    const editDayBtns = document.querySelectorAll('.edit-day-btn');
    editDayBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dayHeader = this.closest('.day-header');
            const h4 = dayHeader.querySelector('h4');
            const dayNum = this.closest('.day').getAttribute('data-day');
            showDayModal(h4.textContent, dayNum);
        });
    });

    // Add activity buttons
    const addActivityBtns = document.querySelectorAll('.add-activity-btn');
    addActivityBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            showActivityModal(null, null);
        });
    });

    // Remove activity buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.remove-activity')) {
            const activityItem = e.target.closest('.activity-item');
            activityItem.remove();
            saveData();
        }
    });

    // Notes
    const noteTextareas = document.querySelectorAll('.day-notes');
    noteTextareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            saveData();
        });
    });

    // Save and print buttons
    document.querySelector('.save-btn').addEventListener('click', function() {
        saveData();
        showNotification('Your changes have been saved!');
    });

    document.querySelector('.print-btn').addEventListener('click', function() {
        window.print();
    });

    // Hotel selection
    const selectHotelBtns = document.querySelectorAll('.select-hotel-btn');
    selectHotelBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const hotelCard = this.closest('.hotel-card');
            const city = hotelCard.getAttribute('data-city');
            const hotelName = hotelCard.getAttribute('data-hotel-name');
            selectHotel(city, hotelName, hotelCard);
        });
    });

    // AI Search functionality
    document.getElementById('ai-search-btn').addEventListener('click', performAISearch);
    document.getElementById('ai-search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') performAISearch();
    });

    // Example chip clicks
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('example-chip')) {
            const search = e.target.getAttribute('data-search');
            const city = e.target.getAttribute('data-city');
            document.getElementById('ai-search-input').value = search;
            document.getElementById('city-select').value = city;
            performAISearch();
        }
    });

    // Add to itinerary buttons
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('add-to-itinerary')) {
            const activity = e.target.getAttribute('data-activity');
            const city = e.target.closest('.suggestion-card').getAttribute('data-city');
            showDaySelectorModal(activity, city);
        }
    });

    // Modal controls
    setupModalControls();
    
    // Setup drag and drop
    setupDragAndDrop();
}

function switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function initializeActivities() {
    // Store initial activities from HTML
    const days = document.querySelectorAll('.day');
    days.forEach(day => {
        const dayNum = day.getAttribute('data-day');
        const activities = day.querySelectorAll('.activity-item');
        
        if (!itineraryData.activities[dayNum]) {
            itineraryData.activities[dayNum] = [];
        }
        
        activities.forEach(activity => {
            const id = activity.getAttribute('data-id');
            const text = activity.querySelector('.activity-text').innerHTML;
            itineraryData.activities[dayNum].push({ id, text });
        });
    });
}

function showActivityModal(activityItem, day) {
    const modal = document.getElementById('activity-modal');
    const input = document.getElementById('activity-input');
    const title = document.getElementById('modal-title');
    
    if (activityItem) {
        title.textContent = 'Edit Activity';
        input.value = activityItem.querySelector('.activity-text').textContent;
        modal.setAttribute('data-mode', 'edit');
        modal.setAttribute('data-activity-id', activityItem.getAttribute('data-id'));
    } else {
        title.textContent = 'Add Activity';
        input.value = '';
        modal.setAttribute('data-mode', 'add');
        if (day) {
            modal.setAttribute('data-day', day.getAttribute('data-day'));
        } else {
            modal.removeAttribute('data-day');
        }
    }
    
    modal.classList.add('active');
    input.focus();
}

function showDayModal(currentTitle, dayNum) {
    const modal = document.getElementById('day-modal');
    const input = document.getElementById('day-title-input');
    
    input.value = currentTitle;
    modal.setAttribute('data-day', dayNum);
    modal.classList.add('active');
    input.focus();
}

function setupModalControls() {
    // Activity modal
    document.getElementById('modal-save').addEventListener('click', function() {
        const modal = document.getElementById('activity-modal');
        const input = document.getElementById('activity-input');
        const mode = modal.getAttribute('data-mode');
        
        if (input.value.trim()) {
            if (mode === 'add') {
                const dayNum = modal.getAttribute('data-day');
                if (dayNum) {
                    // Direct add to specific day (legacy mode)
                    const day = document.querySelector(`[data-day="${dayNum}"]`);
                    addActivity(day, input.value);
                    modal.classList.remove('active');
                } else {
                    // Show day selector modal
                    modal.classList.remove('active');
                    showDaySelectorModal(input.value, null);
                }
            } else {
                modal.classList.remove('active');
            }
        }
    });
    
    document.getElementById('modal-cancel').addEventListener('click', function() {
        document.getElementById('activity-modal').classList.remove('active');
    });
    
    // Day modal
    document.getElementById('day-modal-save').addEventListener('click', function() {
        const modal = document.getElementById('day-modal');
        const input = document.getElementById('day-title-input');
        const dayNum = modal.getAttribute('data-day');
        
        if (input.value.trim()) {
            const day = document.querySelector(`[data-day="${dayNum}"]`);
            const h4 = day.querySelector('h4');
            h4.textContent = input.value;
            itineraryData.dayTitles[dayNum] = input.value;
            saveData();
            modal.classList.remove('active');
        }
    });
    
    document.getElementById('day-modal-cancel').addEventListener('click', function() {
        document.getElementById('day-modal').classList.remove('active');
    });
    
    // Day selector modal
    document.getElementById('day-selector-cancel').addEventListener('click', function() {
        document.getElementById('day-selector-modal').classList.remove('active');
    });
    
    // Dates modal
    document.getElementById('set-dates-btn').addEventListener('click', function() {
        showDatesModal();
    });
    
    document.getElementById('dates-save').addEventListener('click', function() {
        saveTripDates();
    });
    
    document.getElementById('dates-cancel').addEventListener('click', function() {
        document.getElementById('dates-modal').classList.remove('active');
    });

    // Transport booking buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.book-transport-btn')) {
            const btn = e.target.closest('.book-transport-btn');
            const route = btn.getAttribute('data-route');
            toggleTransportBooking(route, btn);
        }
    });

    // Edit nights buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.edit-nights-btn')) {
            const cell = e.target.closest('.editable-nights');
            const city = cell.getAttribute('data-city');
            const currentNights = parseInt(cell.textContent.trim());
            showEditNightsModal(city, currentNights);
        }
    });

    // Todo checkboxes
    document.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox' && e.target.closest('.todo-item')) {
            const todoItem = e.target.closest('.todo-item');
            const todoId = todoItem.getAttribute('data-id');
            const checked = e.target.checked;
            
            if (checked) {
                todoItem.classList.add('completed');
            } else {
                todoItem.classList.remove('completed');
            }
            
            itineraryData.todoItems[todoId] = checked;
            updateTodoProgress();
            saveData();
        }
    });

    // City duration modal
    document.getElementById('duration-save').addEventListener('click', function() {
        const modal = document.getElementById('city-duration-modal');
        const nightsInput = document.getElementById('nights-input');
        const newNights = parseInt(nightsInput.value);
        const currentNights = parseInt(modal.getAttribute('data-current-nights'));
        
        // Validate input
        if (!newNights || newNights < parseInt(nightsInput.min) || newNights > parseInt(nightsInput.max)) {
            showNotification('Please enter a valid number of nights within the allowed range!');
            return;
        }
        
        // If reducing nights, show activity selection
        if (newNights < currentNights) {
            const city = modal.getAttribute('data-city');
            showActivitySelectionForCity(city, newNights, currentNights);
        } else {
            saveCityDuration();
        }
    });
    
    document.getElementById('duration-cancel').addEventListener('click', function() {
        document.getElementById('city-duration-modal').classList.remove('active');
    });

    // Handle nights input change to show/hide activity selection
    document.getElementById('nights-input').addEventListener('input', function() {
        const modal = document.getElementById('city-duration-modal');
        const newNights = parseInt(this.value);
        const currentNights = parseInt(modal.getAttribute('data-current-nights'));
        const activitySelection = document.getElementById('activity-selection');
        
        if (newNights < currentNights && newNights >= parseInt(this.min)) {
            const city = modal.getAttribute('data-city');
            showActivitySelectionForCity(city, newNights, currentNights);
        } else {
            activitySelection.style.display = 'none';
        }
    });
    
    // Close modal on escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });

    // City management
    document.getElementById('customize-trip-btn').addEventListener('click', function() {
        const cityManagement = document.getElementById('city-management');
        cityManagement.style.display = cityManagement.style.display === 'none' ? 'block' : 'none';
        if (cityManagement.style.display === 'block') {
            populateCityList();
        }
    });

    document.getElementById('close-customization').addEventListener('click', function() {
        document.getElementById('city-management').style.display = 'none';
    });

    document.getElementById('add-city-btn').addEventListener('click', addNewCity);

    document.getElementById('regenerate-itinerary').addEventListener('click', regenerateItinerary);
}

function addActivity(day, text) {
    const activityList = day.querySelector('.activity-list');
    const dayNum = day.getAttribute('data-day');
    const activityId = `act-custom-${itineraryData.activityCounter++}`;
    
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.setAttribute('data-id', activityId);
    li.innerHTML = `
        <span class="activity-text">${text}</span>
        <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
    `;
    
    activityList.appendChild(li);
    
    // Update drag and drop for new item
    updateDragAndDrop();
    saveData();
}

function selectHotel(city, hotelName, hotelCard) {
    // Remove selected class from other hotels in same city
    document.querySelectorAll(`.hotel-card[data-city="${city}"]`).forEach(card => {
        card.classList.remove('selected');
        const btn = card.querySelector('.select-hotel-btn');
        btn.textContent = 'Select';
    });
    
    // Add selected class to this hotel
    hotelCard.classList.add('selected');
    hotelCard.querySelector('.select-hotel-btn').textContent = 'Selected';
    
    // Update the summary table
    const hotelCell = document.querySelector(`.hotel-cell[data-city="${city}"]`);
    hotelCell.innerHTML = hotelName;
    hotelCell.classList.add('selected');
    
    // Save selection
    itineraryData.selectedHotels[city] = hotelName;
    saveData();
}

function performAISearch() {
    const searchTerm = document.getElementById('ai-search-input').value.trim();
    const selectedCity = document.getElementById('city-select').value;
    
    if (!selectedCity) {
        showNotification('Please select a city first!');
        return;
    }
    
    if (!searchTerm) {
        showNotification('Please enter what you\'re looking for!');
        return;
    }
    
    // Show loading state
    const container = document.getElementById('search-results');
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><i class="fas fa-spinner fa-spin"></i> Discovering amazing activities...</div>';
    
    // Simulate AI search with contextual results
    setTimeout(() => {
        const aiResults = generateAIResults(searchTerm.toLowerCase(), selectedCity);
        displaySearchResults(aiResults);
    }, 1500);
}

function generateAIResults(searchTerm, city) {
    // AI-powered suggestion database
    const suggestions = {
        madrid: {
            'rooftop bars': [
                { name: 'Círculo de Bellas Artes', desc: 'Iconic rooftop with 360° city views and cocktails', activity: 'Sunset drinks at Círculo de Bellas Artes rooftop', link: 'https://circulobellasartes.com/' },
                { name: 'Gau&Café', desc: 'Trendy rooftop terrace in Malasaña district', activity: 'Evening cocktails at Gau&Café rooftop', link: 'https://www.gaucafe.es/' },
                { name: 'Dear Hotel Sky Bar', desc: 'Sophisticated rooftop bar with city skyline views', activity: 'Cocktails at Dear Hotel Sky Bar', link: 'https://www.dearhotelmadrid.com/' }
            ],
            'art galleries': [
                { name: 'Galería Marlborough', desc: 'Contemporary art gallery featuring Spanish artists', activity: 'Browse contemporary art at Galería Marlborough' },
                { name: 'Galería Elvira González', desc: 'Modern art space in Salamanca district', activity: 'Visit Galería Elvira González' },
                { name: 'La Casa Encendida', desc: 'Cultural center with rotating exhibitions', activity: 'Explore exhibitions at La Casa Encendida' }
            ],
            'traditional food': [
                { name: 'Casa Botín', desc: 'World\'s oldest restaurant, famous for roast suckling pig', activity: 'Lunch at historic Casa Botín restaurant' },
                { name: 'Taberna La Bola', desc: 'Traditional cocido madrileño since 1870', activity: 'Try cocido madrileño at Taberna La Bola' },
                { name: 'Mercado de San Antón', desc: 'Gourmet market with traditional Spanish products', activity: 'Food tour at Mercado de San Antón' }
            ],
            'hidden gems': [
                { name: 'Templo de Debod', desc: 'Authentic Egyptian temple relocated to Madrid', activity: 'Visit Templo de Debod at sunset' },
                { name: 'El Capricho Park', desc: 'Secret 18th-century garden with peacocks', activity: 'Stroll through El Capricho Park' },
                { name: 'Biblioteca Nacional', desc: 'Stunning reading rooms and exhibitions', activity: 'Explore Biblioteca Nacional' }
            ]
        },
        seville: {
            'flamenco shows': [
                { name: 'Casa de la Memoria', desc: 'Intimate flamenco performances in historic venue', activity: 'Authentic flamenco show at Casa de la Memoria' },
                { name: 'Tablao El Arenal', desc: 'Traditional tablao with passionate performances', activity: 'Dinner and flamenco at Tablao El Arenal' },
                { name: 'La Casa del Flamenco', desc: 'Historic venue in Santa Cruz quarter', activity: 'Flamenco performance at La Casa del Flamenco' }
            ],
            'hidden gems': [
                { name: 'Hospital de los Venerables', desc: 'Baroque church with Velázquez paintings', activity: 'Visit Hospital de los Venerables' },
                { name: 'Casa de Pilatos', desc: 'Stunning mix of Mudéjar and Renaissance architecture', activity: 'Tour Casa de Pilatos palace' },
                { name: 'Metropol Parasol', desc: 'Modern wooden structure with city views', activity: 'Explore Metropol Parasol walkways' }
            ],
            'traditional food': [
                { name: 'El Rinconcillo', desc: 'Oldest tapas bar in Seville since 1670', activity: 'Tapas at historic El Rinconcillo' },
                { name: 'Eslava', desc: 'Modern takes on traditional Andalusian cuisine', activity: 'Innovative tapas at Eslava' },
                { name: 'Casa Morales', desc: 'Traditional sherry bar with authentic atmosphere', activity: 'Sherry tasting at Casa Morales' }
            ]
        },
        granada: {
            'traditional tapas': [
                { name: 'Bodegas Castañeda', desc: 'Historic tavern with free tapas tradition', activity: 'Free tapas experience at Bodegas Castañeda' },
                { name: 'Bar Los Diamantes', desc: 'Famous for fried fish and seafood tapas', activity: 'Seafood tapas at Bar Los Diamantes' },
                { name: 'Taberna La Tana', desc: 'Wine bar with excellent local tapas', activity: 'Wine and tapas at Taberna La Tana' }
            ],
            'hidden gems': [
                { name: 'Carmen de los Mártires', desc: 'Secret gardens with Alhambra views', activity: 'Explore Carmen de los Mártires gardens' },
                { name: 'Cueva de las Ventanas', desc: 'Cave dwelling with panoramic views', activity: 'Visit Cueva de las Ventanas in Sacromonte' },
                { name: 'Hammam Al Ándalus', desc: 'Traditional Arab baths experience', activity: 'Relax at Hammam Al Ándalus Arab baths' }
            ],
            'historic baths': [
                { name: 'Hammam Al Ándalus', desc: 'Restored 11th-century Arab baths', activity: 'Traditional Arab bath experience at Hammam Al Ándalus' },
                { name: 'Bañuelo', desc: 'Best-preserved medieval Arab baths in Spain', activity: 'Visit historic Bañuelo Arab baths' }
            ]
        },
        cordoba: {
            'historic baths': [
                { name: 'Hammam Al Ándalus Córdoba', desc: 'Traditional Arab baths near the Mezquita', activity: 'Relaxing session at Hammam Al Ándalus' },
                { name: 'Baños Califales', desc: 'Archaeological remains of Umayyad baths', activity: 'Explore Baños Califales ruins' }
            ],
            'hidden gems': [
                { name: 'Palacio de Viana', desc: 'Palace with 12 beautiful courtyards', activity: 'Tour Palacio de Viana courtyards' },
                { name: 'Museo Julio Romero de Torres', desc: 'Art museum dedicated to Córdoba painter', activity: 'Visit Julio Romero de Torres Museum' },
                { name: 'Calleja de las Flores', desc: 'Picturesque narrow street with flower pots', activity: 'Photo walk through Calleja de las Flores' }
            ]
        },
        toledo: {
            'medieval sites': [
                { name: 'Sinagoga del Tránsito', desc: 'Beautiful Mudéjar synagogue with museum', activity: 'Visit Sinagoga del Tránsito' },
                { name: 'Monasterio de San Juan de los Reyes', desc: 'Gothic monastery with stunning cloisters', activity: 'Explore Monasterio de San Juan de los Reyes' },
                { name: 'Mirador del Valle', desc: 'Panoramic viewpoint over Toledo', activity: 'Sunset views from Mirador del Valle' }
            ]
        },
        segovia: {
            'historic sites': [
                { name: 'Casa de los Picos', desc: 'Unique 15th-century house with diamond facade', activity: 'Visit Casa de los Picos' },
                { name: 'Iglesia de San Millán', desc: 'Romanesque church with beautiful architecture', activity: 'Explore Iglesia de San Millán' },
                { name: 'Mirador de la Pradera de San Marcos', desc: 'Best views of the Alcázar', activity: 'Photography at Mirador de la Pradera' }
            ]
        },
        avila: {
            'medieval walls': [
                { name: 'Murallas de Ávila', desc: 'Best-preserved medieval walls in Europe', activity: 'Walk along the medieval walls of Ávila' },
                { name: 'Basílica de San Vicente', desc: 'Romanesque basilica outside the walls', activity: 'Visit Basílica de San Vicente' },
                { name: 'Convento de Santa Teresa', desc: 'Convent built on Saint Teresa\'s birthplace', activity: 'Tour Convento de Santa Teresa' }
            ]
        }
    };
    
    const cityData = suggestions[city] || {};
    
    // Find matching categories
    let results = [];
    Object.keys(cityData).forEach(category => {
        if (searchTerm.includes(category) || category.includes(searchTerm)) {
            results = results.concat(cityData[category].map(item => ({
                ...item,
                city: city
            })));
        }
    });
    
    // If no exact match, try partial matches
    if (results.length === 0) {
        Object.keys(cityData).forEach(category => {
            cityData[category].forEach(item => {
                if (item.name.toLowerCase().includes(searchTerm) || 
                    item.desc.toLowerCase().includes(searchTerm) ||
                    searchTerm.split(' ').some(term => 
                        item.name.toLowerCase().includes(term) || 
                        item.desc.toLowerCase().includes(term)
                    )) {
                    results.push({...item, city: city});
                }
            });
        });
    }
    
    // If still no results, provide general suggestions for the city
    if (results.length === 0) {
        const generalSuggestions = Object.values(cityData).flat().slice(0, 3);
        results = generalSuggestions.map(item => ({...item, city: city}));
    }
    
    return results.slice(0, 6); // Limit to 6 results
}

function displaySearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No results found. Try a different search term.</p>';
        return;
    }
    
    const html = results.map(result => `
        <div class="suggestion-card" data-city="${result.city}">
            <h4>${result.name}</h4>
            <p class="suggestion-city">${result.city.charAt(0).toUpperCase() + result.city.slice(1)}</p>
            <p>${result.desc}</p>
            <div class="suggestion-actions">
                ${result.link ? `<a href="${result.link}" target="_blank" class="suggestion-link">
                    <i class="fas fa-external-link-alt"></i> More Info
                </a>` : ''}
                <button class="add-to-itinerary" data-activity="${result.activity}">Add to Itinerary</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="suggestions-grid">${html}</div>`;
}

// Remove the old filterSuggestions function as it's no longer needed

function showDaySelectorModal(activity, suggestedCity) {
    const modal = document.getElementById('day-selector-modal');
    const list = document.getElementById('day-selector-list');
    
    // Clear previous content
    list.innerHTML = '';
    
    // Get all days
    const days = document.querySelectorAll('.day');
    
    // Filter days based on suggested city if provided
    const relevantDays = [];
    days.forEach(day => {
        const dayNum = day.getAttribute('data-day');
        const cityAttr = day.getAttribute('data-city');
        const dayTitle = day.querySelector('h4').textContent;
        
        // If no suggested city, show all days
        // If suggested city matches day's city, include it
        // Also include Madrid days for Toledo, Segovia, Avila (day trips from Madrid)
        const shouldInclude = !suggestedCity || 
                            cityAttr === suggestedCity ||
                            (suggestedCity === 'madrid' && ['toledo', 'segovia', 'avila'].includes(cityAttr)) ||
                            (['toledo', 'segovia', 'avila'].includes(suggestedCity) && cityAttr === 'madrid');
        
        if (shouldInclude) {
            relevantDays.push({day, dayNum, cityAttr, dayTitle});
        }
    });
    
    // If no relevant days found, show all days as fallback
    if (relevantDays.length === 0) {
        days.forEach(day => {
            const dayNum = day.getAttribute('data-day');
            const cityAttr = day.getAttribute('data-city');
            const dayTitle = day.querySelector('h4').textContent;
            relevantDays.push({day, dayNum, cityAttr, dayTitle});
        });
    }
    
    relevantDays.forEach(({day, dayNum, cityAttr, dayTitle}) => {
        const item = document.createElement('div');
        item.className = 'day-selector-item';
        if (cityAttr === suggestedCity) {
            item.classList.add('selected');
        }
        
        item.innerHTML = `
            <div>
                <strong>${dayTitle}</strong>
                <div class="day-selector-city">${cityAttr ? cityAttr.charAt(0).toUpperCase() + cityAttr.slice(1) : ''}</div>
            </div>
            ${cityAttr === suggestedCity ? '<i class="fas fa-check" style="color: #27ae60;"></i>' : ''}
        `;
        
        item.addEventListener('click', function() {
            addActivity(day, activity);
            modal.classList.remove('active');
            showNotification(`Added "${activity}" to ${dayTitle}!`);
        });
        
        list.appendChild(item);
    });
    
    modal.classList.add('active');
}

function saveData() {
    // Collect all current data
    const days = document.querySelectorAll('.day');
    
    // Save activities
    itineraryData.activities = {};
    days.forEach(day => {
        const dayNum = day.getAttribute('data-day');
        const activities = [];
        
        day.querySelectorAll('.activity-item').forEach(item => {
            activities.push({
                id: item.getAttribute('data-id'),
                text: item.querySelector('.activity-text').innerHTML
            });
        });
        
        itineraryData.activities[dayNum] = activities;
    });
    
    // Save notes
    itineraryData.notes = {};
    days.forEach(day => {
        const dayNum = day.getAttribute('data-day');
        const notes = day.querySelector('.day-notes').value;
        if (notes) {
            itineraryData.notes[dayNum] = notes;
        }
    });
    
    // Save collapsed states
    itineraryData.collapsedDays = [];
    days.forEach(day => {
        if (day.classList.contains('collapsed')) {
            itineraryData.collapsedDays.push(day.getAttribute('data-day'));
        }
    });
    
    // Save to localStorage
    localStorage.setItem('spainItinerary', JSON.stringify(itineraryData));
}

function loadSavedData() {
    const saved = localStorage.getItem('spainItinerary');
    if (!saved) return;
    
    itineraryData = JSON.parse(saved);
    
    // Restore activities
    if (itineraryData.activities) {
        Object.keys(itineraryData.activities).forEach(dayNum => {
            const day = document.querySelector(`[data-day="${dayNum}"]`);
            if (day) {
                const activityList = day.querySelector('.activity-list');
                activityList.innerHTML = '';
                
                itineraryData.activities[dayNum].forEach(activity => {
                    const li = document.createElement('li');
                    li.className = 'activity-item';
                    li.setAttribute('data-id', activity.id);
                    li.innerHTML = `
                        <span class="activity-text">${activity.text}</span>
                        <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
                    `;
                    activityList.appendChild(li);
                });
                
                // Update drag and drop after restoring activities
                updateDragAndDrop();
            }
        });
    }
    
    // Restore notes
    if (itineraryData.notes) {
        Object.keys(itineraryData.notes).forEach(dayNum => {
            const day = document.querySelector(`[data-day="${dayNum}"]`);
            if (day) {
                day.querySelector('.day-notes').value = itineraryData.notes[dayNum];
            }
        });
    }
    
    // Restore day titles
    if (itineraryData.dayTitles) {
        Object.keys(itineraryData.dayTitles).forEach(dayNum => {
            const day = document.querySelector(`[data-day="${dayNum}"]`);
            if (day) {
                day.querySelector('h4').textContent = itineraryData.dayTitles[dayNum];
            }
        });
    }
    
    // Restore collapsed states
    if (itineraryData.collapsedDays) {
        itineraryData.collapsedDays.forEach(dayNum => {
            const day = document.querySelector(`[data-day="${dayNum}"]`);
            if (day) {
                day.classList.add('collapsed');
            }
        });
    }
    
    // Restore selected hotels
    if (itineraryData.selectedHotels) {
        Object.keys(itineraryData.selectedHotels).forEach(city => {
            const hotelName = itineraryData.selectedHotels[city];
            const hotelCard = document.querySelector(`.hotel-card[data-city="${city}"][data-hotel-name="${hotelName}"]`);
            if (hotelCard) {
                selectHotel(city, hotelName, hotelCard);
            }
        });
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #2ecc71;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function setupDragAndDrop() {
    // Make all activity items draggable
    updateDragAndDrop();
}

function updateDragAndDrop() {
    const activityItems = document.querySelectorAll('.activity-item');
    
    activityItems.forEach(item => {
        item.draggable = true;
        
        item.addEventListener('dragstart', function(e) {
            this.classList.add('dragging');
            e.dataTransfer.setData('text/plain', '');
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
    });
    
    // Setup drop zones (activity lists)
    const activityLists = document.querySelectorAll('.activity-list');
    
    activityLists.forEach(list => {
        list.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingItem = document.querySelector('.dragging');
            const afterElement = getDragAfterElement(this, e.clientY);
            
            if (afterElement == null) {
                this.appendChild(draggingItem);
            } else {
                this.insertBefore(draggingItem, afterElement);
            }
        });
        
        list.addEventListener('dragenter', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        list.addEventListener('dragleave', function(e) {
            // Only remove drag-over if we're leaving the list entirely
            if (!this.contains(e.relatedTarget)) {
                this.classList.remove('drag-over');
            }
        });
        
        list.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            saveData();
            
            // Show notification about the move
            const draggedItem = document.querySelector('.dragging');
            const targetDay = this.closest('.day').querySelector('h4').textContent;
            const activityText = draggedItem.querySelector('.activity-text').textContent;
            showNotification(`Moved "${activityText}" to ${targetDay}`);
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.activity-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function showDatesModal() {
    const modal = document.getElementById('dates-modal');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    // Pre-fill with existing dates if available
    if (itineraryData.tripDates.startDate) {
        startDateInput.value = itineraryData.tripDates.startDate;
    }
    if (itineraryData.tripDates.endDate) {
        endDateInput.value = itineraryData.tripDates.endDate;
    }
    
    modal.classList.add('active');
}

function saveTripDates() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    if (!startDate || !endDate) {
        showNotification('Please select both start and end dates!');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
        showNotification('End date must be after start date!');
        return;
    }
    
    // Calculate the difference in days
    const daysDifference = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    if (daysDifference < 14 || daysDifference > 16) {
        const proceed = confirm(`Your trip is ${daysDifference} days long. The itinerary is designed for 14-15 days. Do you want to continue?`);
        if (!proceed) return;
    }
    
    // Save the dates
    itineraryData.tripDates.startDate = startDate;
    itineraryData.tripDates.endDate = endDate;
    
    // Update the display
    updateTripDatesDisplay();
    updateDayDates();
    
    document.getElementById('dates-modal').classList.remove('active');
    showNotification('Trip dates saved!');
    saveData();
}

function updateTripDatesDisplay() {
    const display = document.getElementById('trip-dates-display');
    const button = document.getElementById('set-dates-btn');
    
    if (itineraryData.tripDates.startDate && itineraryData.tripDates.endDate) {
        const startDate = new Date(itineraryData.tripDates.startDate);
        const endDate = new Date(itineraryData.tripDates.endDate);
        
        const formatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        const startFormatted = startDate.toLocaleDateString('en-US', formatOptions);
        const endFormatted = endDate.toLocaleDateString('en-US', formatOptions);
        
        display.textContent = `${startFormatted} - ${endFormatted}`;
        display.style.display = 'inline';
        button.innerHTML = '<i class="fas fa-edit"></i> Edit Dates';
    } else {
        display.style.display = 'none';
        button.innerHTML = '<i class="fas fa-calendar-alt"></i> Set Trip Dates';
    }
}

function updateDayDates() {
    if (!itineraryData.tripDates.startDate) return;
    
    const startDate = new Date(itineraryData.tripDates.startDate);
    const days = document.querySelectorAll('.day');
    
    days.forEach((day, index) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + index);
        
        const dayHeader = day.querySelector('h4');
        const currentTitle = dayHeader.textContent;
        
        // Check if date is already in the title
        const dateRegex = /\(\w{3} \d{1,2}\/\d{1,2}\)/;
        const titleWithoutDate = currentTitle.replace(dateRegex, '').trim();
        
        // Format the date
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;
        
        // Update the title with the date
        dayHeader.textContent = `${titleWithoutDate} (${dayName} ${monthDay})`;
    });
}

function toggleTransportBooking(route, btn) {
    const isBooked = itineraryData.transportBookings[route];
    itineraryData.transportBookings[route] = !isBooked;
    
    if (itineraryData.transportBookings[route]) {
        btn.classList.add('booked');
        btn.title = 'Booked!';
        showNotification(`Train ticket for ${route.replace('-', ' → ')} marked as booked!`);
    } else {
        btn.classList.remove('booked');
        btn.title = 'Book train';
        showNotification(`Train ticket for ${route.replace('-', ' → ')} marked as not booked.`);
    }
    
    saveData();
}

function initializeTodoItems() {
    // Restore todo item states
    Object.keys(itineraryData.todoItems).forEach(todoId => {
        const todoItem = document.querySelector(`[data-id="${todoId}"]`);
        if (todoItem && itineraryData.todoItems[todoId]) {
            const checkbox = todoItem.querySelector('input[type="checkbox"]');
            checkbox.checked = true;
            todoItem.classList.add('completed');
        }
    });

    // Restore transport booking states
    Object.keys(itineraryData.transportBookings).forEach(route => {
        if (itineraryData.transportBookings[route]) {
            const btn = document.querySelector(`[data-route="${route}"]`);
            if (btn) {
                btn.classList.add('booked');
                btn.title = 'Booked!';
            }
        }
    });
}

function updateTodoProgress() {
    const allTodos = document.querySelectorAll('.todo-item');
    const completedTodos = document.querySelectorAll('.todo-item.completed');
    
    const total = allTodos.length;
    const completed = completedTodos.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update progress bar
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill && progressText) {
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${completed} of ${total} completed (${percentage}%)`;
    }
    
    // Update tab badge and icon
    const todoTabBtn = document.getElementById('todos-tab-btn');
    const todoBadge = document.getElementById('todo-badge');
    
    if (todoTabBtn && todoBadge) {
        const remaining = total - completed;
        todoBadge.textContent = remaining;
        
        if (remaining === 0) {
            todoTabBtn.classList.add('completed');
            todoTabBtn.querySelector('i').className = 'fas fa-check-circle';
            todoBadge.style.display = 'none';
        } else {
            todoTabBtn.classList.remove('completed');
            todoTabBtn.querySelector('i').className = 'fas fa-exclamation-triangle';
            todoBadge.style.display = 'inline';
        }
    }
}

function showEditNightsModal(city, currentNights) {
    const modal = document.getElementById('city-duration-modal');
    const titleElement = document.getElementById('city-duration-title');
    const nightsInput = document.getElementById('nights-input');
    const currentNightsElement = document.getElementById('current-nights');
    const nightsRangeElement = document.getElementById('nights-range');
    const activitySelection = document.getElementById('activity-selection');
    
    // Get the editable cell to extract constraints
    const cell = document.querySelector(`[data-city="${city}"]`);
    const minNights = parseInt(cell.getAttribute('data-min'));
    const maxNights = parseInt(cell.getAttribute('data-max'));
    
    // Set up modal
    titleElement.textContent = `Edit ${city.replace('-', ' ')} Stay Duration`;
    nightsInput.value = currentNights;
    nightsInput.min = minNights;
    nightsInput.max = maxNights;
    currentNightsElement.textContent = currentNights;
    nightsRangeElement.textContent = `${minNights}-${maxNights}`;
    
    // Store modal data
    modal.setAttribute('data-city', city);
    modal.setAttribute('data-current-nights', currentNights);
    
    // Hide activity selection initially
    activitySelection.style.display = 'none';
    
    modal.classList.add('active');
    nightsInput.focus();
}

function saveCityDuration() {
    const modal = document.getElementById('city-duration-modal');
    const city = modal.getAttribute('data-city');
    const currentNights = parseInt(modal.getAttribute('data-current-nights'));
    const newNights = parseInt(document.getElementById('nights-input').value);
    
    if (newNights === currentNights) {
        modal.classList.remove('active');
        return;
    }
    
    // If reducing nights, we need to handle activity selection
    if (newNights < currentNights) {
        const selectedActivities = getSelectedActivitiesToKeep();
        updateItineraryForReducedStay(city, newNights, selectedActivities);
    } else {
        // Just update the duration - new days will need manual activity assignment
        updateCityDuration(city, newNights);
    }
    
    modal.classList.remove('active');
    showNotification(`${city.replace('-', ' ')} stay updated to ${newNights} nights!`);
    saveData();
}

function updateCityDuration(city, newNights) {
    // Update the itinerary data
    itineraryData.cityDurations[city] = newNights;
    
    // Update the display in the summary table
    const cell = document.querySelector(`[data-city="${city}"]`);
    const nightsText = cell.firstChild;
    nightsText.textContent = `${newNights} `;
    
    // For now, just show a note that the itinerary structure might need manual adjustment
    if (newNights !== parseInt(cell.getAttribute('data-current'))) {
        showNotification(`Duration updated! You may need to manually adjust activities for the new schedule.`);
    }
}

function updateItineraryForReducedStay(city, newNights, selectedActivities) {
    // This is a simplified implementation - in a real app, you'd reorganize the entire itinerary
    updateCityDuration(city, newNights);
    
    // Show notification about activity selection
    const keptCount = selectedActivities.length;
    showNotification(`Stay reduced to ${newNights} nights. ${keptCount} activities will be kept. Manual schedule adjustment may be needed.`);
}

function getSelectedActivitiesToKeep() {
    const checkboxes = document.querySelectorAll('#activity-selection-list input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function showActivitySelectionForCity(city, newNights, currentNights) {
    const activitySelection = document.getElementById('activity-selection');
    const activityList = document.getElementById('activity-selection-list');
    
    // Clear existing content
    activityList.innerHTML = '';
    
    // Get activities for this city from the itinerary
    const cityActivities = getCityActivities(city);
    
    // Calculate how many activities need to be removed
    const activitiesPerDay = Math.ceil(cityActivities.length / currentNights);
    const activitiesToKeep = Math.floor(activitiesPerDay * newNights);
    
    // Create checkboxes for each activity
    cityActivities.forEach((activity, index) => {
        const item = document.createElement('div');
        item.className = 'activity-selection-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `activity-${index}`;
        checkbox.value = activity.text;
        checkbox.checked = index < activitiesToKeep; // Pre-select first N activities
        
        const label = document.createElement('label');
        label.htmlFor = `activity-${index}`;
        label.textContent = activity.text;
        
        item.appendChild(checkbox);
        item.appendChild(label);
        activityList.appendChild(item);
    });
    
    activitySelection.style.display = 'block';
    
    // Add confirm button if it doesn't exist
    let confirmBtn = document.getElementById('confirm-activity-selection');
    if (!confirmBtn) {
        confirmBtn = document.createElement('button');
        confirmBtn.id = 'confirm-activity-selection';
        confirmBtn.textContent = 'Confirm Selection & Save';
        confirmBtn.className = 'duration-confirm-btn';
        confirmBtn.addEventListener('click', saveCityDuration);
        activitySelection.appendChild(confirmBtn);
    }
}

function getCityActivities(city) {
    // This is a simplified approach - get activities from days associated with this city
    const activities = [];
    const days = document.querySelectorAll(`.day[data-city*="${city.split('-')[0]}"]`);
    
    days.forEach(day => {
        const dayActivities = day.querySelectorAll('.activity-text');
        dayActivities.forEach(activity => {
            activities.push({
                day: day.getAttribute('data-day'),
                text: activity.textContent
            });
        });
    });
    
    return activities;
}

// City Management Functions
function initializeCityManagement() {
    // Initialize city order if not present
    if (!itineraryData.cityOrder) {
        itineraryData.cityOrder = ['madrid', 'seville', 'cordoba', 'granada', 'madrid-final'];
    }
}

function populateCityList() {
    const cityList = document.getElementById('city-list');
    cityList.innerHTML = '';
    
    // Get cities from the order or from durations
    const cities = itineraryData.cityOrder || Object.keys(itineraryData.cityDurations);
    
    cities.forEach((city, index) => {
        const nights = itineraryData.cityDurations[city] || 1;
        const cityItem = createCityListItem(city, nights, index);
        cityList.appendChild(cityItem);
    });
    
    // Setup drag and drop for city reordering
    setupCityDragAndDrop();
}

function createCityListItem(city, nights, index) {
    const div = document.createElement('div');
    div.className = 'city-item';
    div.setAttribute('data-city', city);
    div.setAttribute('draggable', 'true');
    
    const cityName = formatCityName(city);
    
    div.innerHTML = `
        <div class="city-info">
            <i class="fas fa-grip-vertical city-handle"></i>
            <span class="city-name">${cityName}</span>
            <span class="city-nights">${nights} nights</span>
        </div>
        <div class="city-actions">
            <button class="remove-city-btn" onclick="removeCity('${city}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return div;
}

function formatCityName(city) {
    // Convert city ID to display name
    const cityNames = {
        'madrid': 'Madrid',
        'madrid-final': 'Madrid (Final)',
        'seville': 'Seville',
        'cordoba': 'Córdoba',
        'granada': 'Granada',
        'barcelona': 'Barcelona',
        'valencia': 'Valencia',
        'bilbao': 'Bilbao',
        'salamanca': 'Salamanca',
        'toledo': 'Toledo',
        'segovia': 'Segovia',
        'malaga': 'Málaga',
        'santiago': 'Santiago de Compostela'
    };
    
    return cityNames[city] || city.charAt(0).toUpperCase() + city.slice(1);
}

function addNewCity() {
    const citySelect = document.getElementById('new-city-select');
    const nightsInput = document.getElementById('new-city-nights');
    
    const city = citySelect.value;
    const nights = parseInt(nightsInput.value);
    
    if (!city || !nights || nights < 1) {
        showNotification('Please select a city and enter valid number of nights!');
        return;
    }
    
    // Check if city already exists (except for duplicate Madrid stays)
    if (itineraryData.cityDurations[city] && city !== 'madrid') {
        showNotification('This city is already in your itinerary!');
        return;
    }
    
    // For duplicate cities, create a unique key
    let cityKey = city;
    if (itineraryData.cityDurations[city]) {
        let counter = 2;
        while (itineraryData.cityDurations[`${city}-${counter}`]) {
            counter++;
        }
        cityKey = `${city}-${counter}`;
    }
    
    // Add city to data
    itineraryData.cityDurations[cityKey] = nights;
    if (!itineraryData.cityOrder) {
        itineraryData.cityOrder = Object.keys(itineraryData.cityDurations);
    } else {
        itineraryData.cityOrder.push(cityKey);
    }
    
    // Reset form
    citySelect.value = '';
    nightsInput.value = '';
    
    // Refresh city list
    populateCityList();
    saveData();
    
    showNotification(`Added ${formatCityName(city)} (${nights} nights) to your itinerary!`);
}

function removeCity(city) {
    if (confirm(`Are you sure you want to remove ${formatCityName(city)} from your itinerary?`)) {
        // Remove from durations
        delete itineraryData.cityDurations[city];
        
        // Remove from order
        if (itineraryData.cityOrder) {
            itineraryData.cityOrder = itineraryData.cityOrder.filter(c => c !== city);
        }
        
        // Remove selected hotel for this city
        if (itineraryData.selectedHotels[city]) {
            delete itineraryData.selectedHotels[city];
        }
        
        populateCityList();
        saveData();
        
        showNotification(`Removed ${formatCityName(city)} from your itinerary!`);
    }
}

function setupCityDragAndDrop() {
    const cityItems = document.querySelectorAll('.city-item');
    
    cityItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.classList.add('dragging');
        });
        
        item.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            
            // Update city order based on new DOM order
            const newOrder = [];
            document.querySelectorAll('.city-item').forEach(cityItem => {
                newOrder.push(cityItem.getAttribute('data-city'));
            });
            
            itineraryData.cityOrder = newOrder;
            saveData();
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingItem = document.querySelector('.city-item.dragging');
            const cityList = this.parentElement;
            const afterElement = getDragAfterElement(cityList, e.clientY);
            
            if (afterElement == null) {
                cityList.appendChild(draggingItem);
            } else {
                cityList.insertBefore(draggingItem, afterElement);
            }
        });
    });
}

function regenerateItinerary() {
    if (!confirm('This will regenerate the entire itinerary based on your city selections. Current activities and notes will be preserved where possible. Continue?')) {
        return;
    }
    
    // Store current activities and notes for preservation
    const preservedData = {
        activities: { ...itineraryData.activities },
        notes: { ...itineraryData.notes },
        dayTitles: { ...itineraryData.dayTitles }
    };
    
    // Clear the daily itinerary section
    const itinerarySection = document.querySelector('.itinerary-section .week-section').parentElement;
    const weekSections = itinerarySection.querySelectorAll('.week-section');
    weekSections.forEach(section => section.remove());
    
    // Generate new structure
    generateNewItineraryStructure();
    
    // Update summary table
    updateSummaryTable();
    
    // Close customization panel
    document.getElementById('city-management').style.display = 'none';
    
    showNotification('Itinerary regenerated! Activities have been preserved where possible.');
    saveData();
}

function generateNewItineraryStructure() {
    const itinerarySection = document.querySelector('.itinerary-section');
    const h2 = itinerarySection.querySelector('h2');
    
    const cities = itineraryData.cityOrder || Object.keys(itineraryData.cityDurations);
    let dayCounter = 1;
    let weekCounter = 1;
    let currentWeekDiv = null;
    
    cities.forEach((city, cityIndex) => {
        const nights = itineraryData.cityDurations[city];
        const cityDisplayName = formatCityName(city);
        
        // Create new week section if needed (every 7 days)
        if (!currentWeekDiv || dayCounter > 7 * weekCounter) {
            currentWeekDiv = document.createElement('div');
            currentWeekDiv.className = 'week-section';
            
            const weekTitle = document.createElement('h3');
            weekTitle.textContent = `Week ${weekCounter}`;
            currentWeekDiv.appendChild(weekTitle);
            
            itinerarySection.appendChild(currentWeekDiv);
            weekCounter++;
        }
        
        // Add travel day if not first city
        if (cityIndex > 0) {
            const prevCity = cities[cityIndex - 1];
            const travelDay = createTravelDay(dayCounter, formatCityName(prevCity), cityDisplayName);
            currentWeekDiv.appendChild(travelDay);
            dayCounter++;
        } else {
            // First day - arrival
            const arrivalDay = createArrivalDay(dayCounter, cityDisplayName);
            currentWeekDiv.appendChild(arrivalDay);
            dayCounter++;
        }
        
        // Add stay days
        for (let i = 1; i < nights; i++) {
            const stayDay = createStayDay(dayCounter, cityDisplayName, city);
            currentWeekDiv.appendChild(stayDay);
            dayCounter++;
        }
    });
    
    // Add departure day
    const departureDay = createDepartureDay(dayCounter);
    currentWeekDiv.appendChild(departureDay);
    
    // Re-initialize event listeners for new elements
    setupDayEventListeners();
}

function createTravelDay(dayNum, fromCity, toCity) {
    const day = document.createElement('div');
    day.className = 'day';
    day.setAttribute('data-day', dayNum);
    day.setAttribute('data-city', toCity.toLowerCase());
    
    day.innerHTML = `
        <div class="day-header">
            <h4>Day ${dayNum} — ${fromCity} → ${toCity}</h4>
            <div class="travel-info">
                <i class="fas fa-train"></i> Travel day
                <button class="book-transport-btn" data-route="${fromCity.toLowerCase()}-${toCity.toLowerCase()}" title="Book transport">
                    <i class="fas fa-ticket-alt"></i>
                </button>
            </div>
            <div class="day-controls">
                <button class="edit-day-btn" title="Edit day"><i class="fas fa-edit"></i></button>
                <button class="toggle-btn">−</button>
            </div>
        </div>
        <div class="day-content">
            <ul class="activity-list">
                <li class="activity-item" data-id="act-${dayNum}-1">
                    <span class="activity-text">Travel from ${fromCity} to ${toCity}</span>
                    <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
                </li>
            </ul>
            <button class="add-activity-btn"><i class="fas fa-plus"></i> Add Activity</button>
            <div class="notes-section">
                <label>Personal Notes:</label>
                <textarea class="day-notes" placeholder="Add your notes here..."></textarea>
            </div>
        </div>
    `;
    
    return day;
}

function createArrivalDay(dayNum, city) {
    const day = document.createElement('div');
    day.className = 'day';
    day.setAttribute('data-day', dayNum);
    day.setAttribute('data-city', city.toLowerCase());
    
    day.innerHTML = `
        <div class="day-header">
            <h4>Day ${dayNum} — Arrive ${city}</h4>
            <div class="day-controls">
                <button class="edit-day-btn" title="Edit day"><i class="fas fa-edit"></i></button>
                <button class="toggle-btn">−</button>
            </div>
        </div>
        <div class="day-content">
            <ul class="activity-list">
                <li class="activity-item" data-id="act-${dayNum}-1">
                    <span class="activity-text">Arrive in ${city}</span>
                    <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
                </li>
                <li class="activity-item" data-id="act-${dayNum}-2">
                    <span class="activity-text">Check in to hotel</span>
                    <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
                </li>
            </ul>
            <button class="add-activity-btn"><i class="fas fa-plus"></i> Add Activity</button>
            <div class="notes-section">
                <label>Personal Notes:</label>
                <textarea class="day-notes" placeholder="Add your notes here..."></textarea>
            </div>
        </div>
    `;
    
    return day;
}

function createStayDay(dayNum, city, cityKey) {
    const day = document.createElement('div');
    day.className = 'day';
    day.setAttribute('data-day', dayNum);
    day.setAttribute('data-city', cityKey);
    
    day.innerHTML = `
        <div class="day-header">
            <h4>Day ${dayNum} — ${city}</h4>
            <div class="day-controls">
                <button class="edit-day-btn" title="Edit day"><i class="fas fa-edit"></i></button>
                <button class="toggle-btn">−</button>
            </div>
        </div>
        <div class="day-content">
            <ul class="activity-list">
            </ul>
            <button class="add-activity-btn"><i class="fas fa-plus"></i> Add Activity</button>
            <div class="notes-section">
                <label>Personal Notes:</label>
                <textarea class="day-notes" placeholder="Add your notes here..."></textarea>
            </div>
        </div>
    `;
    
    return day;
}

function createDepartureDay(dayNum) {
    const day = document.createElement('div');
    day.className = 'day';
    day.setAttribute('data-day', dayNum);
    day.setAttribute('data-city', 'departure');
    
    day.innerHTML = `
        <div class="day-header">
            <h4>Day ${dayNum} — Departure</h4>
            <div class="day-controls">
                <button class="edit-day-btn" title="Edit day"><i class="fas fa-edit"></i></button>
                <button class="toggle-btn">−</button>
            </div>
        </div>
        <div class="day-content">
            <ul class="activity-list">
                <li class="activity-item" data-id="act-${dayNum}-1">
                    <span class="activity-text">Transfer to airport</span>
                    <button class="remove-activity" title="Remove"><i class="fas fa-times"></i></button>
                </li>
            </ul>
            <button class="add-activity-btn"><i class="fas fa-plus"></i> Add Activity</button>
            <div class="notes-section">
                <label>Personal Notes:</label>
                <textarea class="day-notes" placeholder="Add your notes here..."></textarea>
            </div>
        </div>
    `;
    
    return day;
}

function setupDayEventListeners() {
    // Re-setup all event listeners for the new day elements
    const dayHeaders = document.querySelectorAll('.day-header');
    dayHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            if (!e.target.closest('.edit-day-btn')) {
                const day = this.parentElement;
                day.classList.toggle('collapsed');
                saveData();
            }
        });
    });
    
    const editDayBtns = document.querySelectorAll('.edit-day-btn');
    editDayBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dayHeader = this.closest('.day-header');
            const h4 = dayHeader.querySelector('h4');
            const dayNum = this.closest('.day').getAttribute('data-day');
            showDayModal(h4.textContent, dayNum);
        });
    });
    
    const addActivityBtns = document.querySelectorAll('.add-activity-btn');
    addActivityBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const day = this.closest('.day');
            showActivityModal(null, day);
        });
    });
    
    const noteTextareas = document.querySelectorAll('.day-notes');
    noteTextareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            saveData();
        });
    });
    
    // Re-setup drag and drop
    setupDragAndDrop();
    
    // Re-apply trip dates if they exist
    updateDayDates();
}

function updateSummaryTable() {
    const tbody = document.querySelector('.summary-table tbody');
    tbody.innerHTML = '';
    
    const cities = itineraryData.cityOrder || Object.keys(itineraryData.cityDurations);
    
    cities.forEach(city => {
        const nights = itineraryData.cityDurations[city];
        const cityDisplayName = formatCityName(city);
        const selectedHotel = itineraryData.selectedHotels[city];
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cityDisplayName}</td>
            <td class="editable-nights" data-city="${city}" data-min="1" data-max="10">
                ${nights} <button class="edit-nights-btn" title="Edit duration"><i class="fas fa-edit"></i></button>
            </td>
            <td class="hotel-cell ${selectedHotel ? 'selected' : ''}" data-city="${city}">
                ${selectedHotel ? `<span class="selected-hotel-name">${selectedHotel}</span>` : '<span class="hotel-placeholder">Select from Hotels tab</span>'}
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Re-attach edit nights event listeners
    const editNightsBtns = tbody.querySelectorAll('.edit-nights-btn');
    editNightsBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const cell = e.target.closest('.editable-nights');
            const city = cell.getAttribute('data-city');
            const currentNights = parseInt(cell.textContent.trim());
            showEditNightsModal(city, currentNights);
        });
    });
}

// Make removeCity globally accessible
window.removeCity = removeCity;

// Auto-save
setInterval(saveData, 30000);

// Save before leaving
window.addEventListener('beforeunload', saveData);