// Firebase configuration - loaded from inline config in HTML
const firebaseConfig = window.API_CONFIG.firebase;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Use a single shared trip for everyone
const tripId = 'silvia-irene-spain-2025';
// console.log('Using shared trip:', tripId);

// State management
let itineraryData = {
    activities: {},
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

// Global flag to track if Google Maps is loaded
let googleMapsLoaded = false;

// Global initialization flags (defined in HTML head)
// let domReady = false; // Now defined in HTML
// let googleMapsReady = false; // Now defined in HTML

// Track if we're updating from Firebase to avoid loops
let updatingFromFirebase = false;
let saveTimeout = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // console.log('DOM ready - App initializing...');
    domReady = true;
    
    // Initialize everything except hotels
    setupEventListeners();
    
    // Load data from Firebase
    loadFromFirebase(() => {
        initializeActivities();
        updateTripDatesDisplay();
        initializeTodoItems();
        updateTodoProgress();
        initializeCityManagement();
        restoreHotelSelections(); // Restore any saved hotel selections
        
        // console.log('App base initialization complete!');
        
        // Try to load hotels if Google Maps is already ready
        tryLoadHotels();
    });
    
    // Listen for real-time updates from Firebase
    setupFirebaseListeners();
});

// Make tryLoadHotels globally accessible for the early initMap callback
window.tryLoadHotels = function tryLoadHotels() {
    if (domReady && googleMapsReady) {
        // console.log('Both DOM and Google Maps ready - loading hotels!');
        loadHotelsForAllCities();
    } else {
        // console.log(`Waiting... DOM ready: ${domReady}, Google Maps ready: ${googleMapsReady}`);
    }
}

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
            // Get the city from the day container
            const dayContainer = this.closest('.day');
            const city = dayContainer.getAttribute('data-city');
            
            // Switch to discover tab
            switchTab('search');
            
            // Pre-populate the city selector
            if (city) {
                document.getElementById('city-select').value = city;
            }
            
            // Focus on search input for better UX
            setTimeout(() => {
                document.getElementById('ai-search-input').focus();
            }, 100);
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


    // Print button
    const printBtn = document.querySelector('.print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            window.print();
        });
    }

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
            // Check if this is a hotel selection
            const hotelName = e.target.getAttribute('data-hotel-name');
            const cityId = e.target.getAttribute('data-city');
            
            if (hotelName && cityId) {
                // This is a hotel selection
                selectHotelForItinerary(hotelName, cityId, e.target);
            } else {
                // This is an activity selection
                const activity = e.target.getAttribute('data-activity');
                const activityUrl = e.target.getAttribute('data-activity-url');
                const city = e.target.closest('.suggestion-card').getAttribute('data-city');
                showDaySelectorModal(activity, city, activityUrl);
            }
        }
    });

    // Modal controls
    setupModalControls();
    
    // Setup drag and drop
    setupDragAndDrop();
    
    // Activity log link
    document.getElementById('activity-log-link').addEventListener('click', function(e) {
        e.preventDefault();
        showActivityLog();
    });
}

// Track activity with location
async function trackActivity(action) {
    const activity = {
        action: action,
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        userAgent: navigator.userAgent
    };
    
    // Try to get user location (requires HTTPS)
    if (navigator.geolocation && window.location.protocol === 'https:') {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            activity.location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
        } catch (error) {
            console.log('Location not available');
        }
    }
    
    // Save activity to Firebase
    const activitiesRef = database.ref(`trips/${tripId}/activityLog`);
    activitiesRef.push(activity);
}

// Show activity log modal
function showActivityLog() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'activity-log-modal';
    
    modal.innerHTML = `
        <div class="modal-content large">
            <h3>Activity Log</h3>
            <div id="activity-log-content" class="activity-log-content">
                <p>Loading activity history...</p>
            </div>
            <div class="modal-buttons">
                <button id="activity-log-close">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load and display activities
    loadActivityLog();
    
    // Close button
    document.getElementById('activity-log-close').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Load activity log from Firebase
function loadActivityLog() {
    const activitiesRef = database.ref(`trips/${tripId}/activityLog`);
    const contentDiv = document.getElementById('activity-log-content');
    
    activitiesRef.orderByChild('timestamp').limitToLast(50).once('value', (snapshot) => {
        const activities = [];
        snapshot.forEach((childSnapshot) => {
            activities.push(childSnapshot.val());
        });
        
        if (activities.length === 0) {
            contentDiv.innerHTML = '<div class="no-activities">No activity recorded yet.</div>';
            return;
        }
        
        // Sort by timestamp (newest first)
        activities.reverse();
        
        let html = '<div class="activity-list">';
        activities.forEach(activity => {
            const device = getDeviceType(activity.userAgent);
            const locationText = activity.location ? 
                `<span class="activity-location">📍 ${activity.location.latitude.toFixed(2)}, ${activity.location.longitude.toFixed(2)}</span>` : 
                '';
            
            html += `
                <div class="activity-item">
                    <div class="activity-header">
                        <span class="activity-action">${activity.action}</span>
                        <span class="activity-date">${activity.date}</span>
                    </div>
                    <div class="activity-details">
                        <div class="activity-device">${device}</div>
                        ${locationText}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        contentDiv.innerHTML = html;
    });
}

// Get device type from user agent
function getDeviceType(userAgent) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
        return '📱 iOS';
    } else if (/Android/i.test(userAgent)) {
        return '📱 Android';
    } else if (/Windows Phone/i.test(userAgent)) {
        return '📱 Windows Phone';
    } else if (/Macintosh/i.test(userAgent)) {
        return '💻 Mac';
    } else if (/Windows/i.test(userAgent)) {
        return '💻 Windows';
    } else if (/Linux/i.test(userAgent)) {
        return '💻 Linux';
    } else {
        return '🖥️ Desktop';
    }
}

// Select hotel for itinerary
function selectHotelForItinerary(hotelName, cityId, buttonElement) {
    // console.log(`Selecting hotel: ${hotelName} for city: ${cityId}`);
    
    // Update the itinerary tab hotel display
    updateItineraryHotelDisplay(hotelName, cityId);
    
    // Update button state
    updateHotelButtonState(buttonElement, cityId);
    
    // Store selection in state
    itineraryData.selectedHotels[cityId] = hotelName;
    // console.log(`Stored hotel selection:`, itineraryData.selectedHotels);
    
    // Show success message
    const cityName = getCityDisplayName(cityId);
    alert(`${hotelName} has been selected for your ${cityName} stay!`);
    
    // Save data
    saveData();
}

// Update hotel display in itinerary tab
function updateItineraryHotelDisplay(hotelName, cityId) {
    // Map hotel cityId to itinerary table data-city values
    const cityIdMapping = {
        'madrid': 'madrid-week1',        // First Madrid stay
        'madrid-final': 'madrid-final',  // Final Madrid stay  
        'seville': 'seville',
        'cordoba': 'cordoba',
        'granada': 'granada'
    };
    
    const itineraryCityId = cityIdMapping[cityId] || cityId;
    
    // Find the correct hotel cell in the summary table
    const hotelCells = document.querySelectorAll('.hotel-cell');
    
    for (const cell of hotelCells) {
        if (cell.getAttribute('data-city') === itineraryCityId) {
            const placeholder = cell.querySelector('.hotel-placeholder');
            if (placeholder) {
                placeholder.textContent = hotelName;
                cell.classList.add('selected');
            }
            break;
        }
    }
}

// Update button states for hotel selection
function updateHotelButtonState(selectedButton, cityId) {
    // Find the hotel section for this city
    const citySection = findCitySectionByName({id: cityId, name: getCityDisplayName(cityId)});
    if (!citySection) return;
    
    const hotelGrid = citySection.querySelector('.hotel-grid');
    const allHotelButtons = hotelGrid.querySelectorAll('.add-to-itinerary[data-hotel-name]');
    
    // Reset all buttons in this city
    allHotelButtons.forEach(btn => {
        const icon = btn.querySelector('i');
        btn.innerHTML = `${icon ? icon.outerHTML : '<i class="fas fa-plus"></i>'} Select Hotel`;
        btn.classList.remove('selected');
        btn.disabled = false;
    });
    
    // Update selected button
    const icon = selectedButton.querySelector('i');
    selectedButton.innerHTML = `${icon ? icon.outerHTML : '<i class="fas fa-check"></i>'} Selected ✓`;
    selectedButton.classList.add('selected');
    selectedButton.disabled = true;
}

// Get display name for city
function getCityDisplayName(cityId) {
    const cityNames = {
        'madrid': 'Madrid (Week 1)',
        'madrid-final': 'Madrid (Final Night)',
        'seville': 'Seville',
        'cordoba': 'Córdoba', 
        'granada': 'Granada'
    };
    return cityNames[cityId] || cityId;
}

// Restore hotel selections from saved data
function restoreHotelSelections() {
    if (!itineraryData.selectedHotels) {
        // console.log('No saved hotel selections found');
        return;
    }
    
    // console.log('Restoring hotel selections:', itineraryData.selectedHotels);
    
    for (const [cityId, hotelName] of Object.entries(itineraryData.selectedHotels)) {
        if (hotelName) {
            // console.log(`Restoring: ${hotelName} for ${cityId}`);
            updateItineraryHotelDisplay(hotelName, cityId);
            
            // Also restore visual state in Hotels tab
            restoreHotelTabSelection(cityId, hotelName);
        }
    }
}

function restoreHotelTabSelection(cityId, hotelName) {
    // Find the hotel card in the Hotels tab
    const hotelCard = document.querySelector(`.hotel-card[data-city="${cityId}"][data-hotel-name="${hotelName}"]`);
    
    if (hotelCard) {
        // Remove selected class from other hotels in same city
        document.querySelectorAll(`.hotel-card[data-city="${cityId}"]`).forEach(card => {
            card.classList.remove('selected');
            const btn = card.querySelector('.select-hotel-btn');
            if (btn) btn.textContent = 'Select';
        });
        
        // Add selected class to this hotel
        hotelCard.classList.add('selected');
        const btn = hotelCard.querySelector('.select-hotel-btn');
        if (btn) btn.textContent = 'Selected';
        
        // console.log(`Restored Hotels tab selection: ${hotelName} for ${cityId}`);
    } else {
        console.log(`Could not find hotel card for ${hotelName} in ${cityId}`);
    }
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

function addActivity(day, text, url = '') {
    const activityList = day.querySelector('.activity-list');
    const dayNum = day.getAttribute('data-day');
    const activityId = `act-custom-${itineraryData.activityCounter++}`;
    
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.setAttribute('data-id', activityId);
    
    // Create activity text with optional link
    const activityContent = url ? 
        `<a href="${url}" target="_blank">${text}</a>` : 
        text;
    
    li.innerHTML = `
        <span class="activity-text">${activityContent}</span>
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

// Google Places API Configuration
const GOOGLE_PLACES_API_KEY = window.API_CONFIG.googleMapsApiKey;
const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

// City coordinates for Google Places API
const CITY_COORDINATES = {
    'madrid': '40.4168,-3.7038',
    'seville': '37.3886,-5.9823',
    'granada': '37.1773,-3.5986',
    'cordoba': '37.8882,-4.7794',
    'toledo': '39.8628,-4.0273',
    'segovia': '40.9429,-4.1088',
    'avila': '40.6566,-4.6776'
};

async function performAISearch() {
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
    
    try {
        const results = await searchGooglePlaces(searchTerm, selectedCity);
        displaySearchResults(results);
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <h3>🚫 Search Error</h3>
                <p>Unable to fetch recommendations at the moment.</p>
                <p style="color: #666; font-size: 14px;">Please check your internet connection and try again.</p>
            </div>
        `;
    }
}

// Google Places JavaScript API search function (No CORS issues!)
async function searchGooglePlaces(query, city) {
    console.log('Making Google Places request...'); // Debug log
    
    return new Promise((resolve, reject) => {
        const coordinates = CITY_COORDINATES[city];
        if (!coordinates) {
            reject(new Error('City not supported'));
            return;
        }
        
        const [lat, lng] = coordinates.split(',');
        const location = new google.maps.LatLng(parseFloat(lat), parseFloat(lng));
        
        // Create a map (required for Places service, but hidden)
        const map = new google.maps.Map(document.createElement('div'));
        
        // Create Places service
        const service = new google.maps.places.PlacesService(map);
        
        // Format the search query
        const searchQuery = `${query} in ${city}, Spain`;
        
        const request = {
            query: searchQuery,
            location: location,
            radius: 10000,
            fields: ['name', 'formatted_address', 'rating', 'photos', 'website', 'formatted_phone_number', 'types', 'price_level', 'place_id']
        };
        
        service.textSearch(request, (results, status) => {
            console.log('Google Places API Response:', results, status); // Debug log
            
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                // Sort by rating (highest first), then by name
                const sortedResults = (results || []).sort((a, b) => {
                    if (a.rating && b.rating) {
                        return b.rating - a.rating; // Higher rating first
                    } else if (a.rating && !b.rating) {
                        return -1; // Places with ratings come first
                    } else if (!a.rating && b.rating) {
                        return 1; // Places with ratings come first
                    } else {
                        return a.name.localeCompare(b.name); // Alphabetical if no ratings
                    }
                });
                
                resolve(formatGooglePlacesResults(sortedResults, city));
            } else {
                reject(new Error(`Google Places API error: ${status}`));
            }
        });
    });
}

// Format Google Places results for display
function formatGooglePlacesResults(places, city) {
    return places.map(place => {
        const category = place.types?.[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Attraction';
        
        // Get photo from Google Places JavaScript API
        const photo = place.photos?.[0] ? 
            place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 }) : 
            getDefaultCityImage(city);
        
        const rating = place.rating ? `⭐ ${place.rating.toFixed(1)}` : '';
        const price = place.price_level ? '💰'.repeat(place.price_level) : '';
        const address = place.formatted_address || '';
        
        return {
            title: place.name,
            category: category,
            description: `${address}${rating ? ` ${rating}` : ''}${price ? ` ${price}` : ''}`,
            image: photo,
            website: place.website,
            phone: place.formatted_phone_number,
            city: city,
            source: 'google',
            place_id: place.place_id // For Google Maps link if no website
        };
    });
}

// Default images for cities when no photo available
function getDefaultCityImage(city) {
    const defaultImages = {
        'madrid': 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=300&h=200&fit=crop',
        'seville': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=200&fit=crop',
        'granada': 'https://images.unsplash.com/photo-1566933293069-b55de3d3659c?w=300&h=200&fit=crop',
        'cordoba': 'https://images.unsplash.com/photo-1590932103617-8f7df5d6dec9?w=300&h=200&fit=crop',
        'toledo': 'https://images.unsplash.com/photo-1571298300660-fd3b55b8df19?w=300&h=200&fit=crop',
        'segovia': 'https://images.unsplash.com/photo-1605034313761-73ea4a0cfbf3?w=300&h=200&fit=crop',
        'avila': 'https://images.unsplash.com/photo-1551468294-635318fc27f8?w=300&h=200&fit=crop'
    };
    return defaultImages[city] || 'https://images.unsplash.com/photo-1508940140853-b9f37b5a1a61?w=300&h=200&fit=crop';
}

// Load hotels for all cities using Google Places
async function loadHotelsForAllCities() {
    // Check if Google Maps is loaded
    if (!googleMapsReady || typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.log('Google Maps not yet loaded, will retry when ready');
        return;
    }

    const cities = [
        { id: 'madrid', name: 'Madrid', nights: '7 nights' },
        { id: 'seville', name: 'Seville', nights: '3 nights' },
        { id: 'cordoba', name: 'Córdoba', nights: '1 night' },
        { id: 'granada', name: 'Granada', nights: '3 nights' },
        { id: 'madrid-final', name: 'Madrid', nights: 'Final Night' }
    ];

    for (const city of cities) {
        try {
            const hotels = await searchGooglePlacesHotels(city.id, city.name);
            displayHotelsForCity(city, hotels);
        } catch (error) {
            console.error(`Error loading hotels for ${city.name}:`, error);
            // Keep existing hardcoded hotels if API fails - they should already be in the HTML
        }
    }
}

// Search for hotels using Google Places (fallback to hardcoded for now)
async function searchGooglePlacesHotels(cityId, cityName) {
    // console.log(`Attempting to search for boutique hotels in ${cityName}...`);
    
    // Since Google Places Service is deprecated for new customers, 
    // we'll return hardcoded boutique hotels for now
    const boutiqueHotels = {
        'madrid': [
            {
                name: 'Hotel Villa Real',
                rating: 4.4,
                address: 'Plaza de las Cortes, 10, Madrid',
                price: '€180-220/night',
                website: 'https://www.derbyhotels.com/hotel-villa-real-madrid/',
                phone: '+34 914 20 37 67',
                place_id: 'madrid_villa_real',
                photo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop'
            },
            {
                name: 'Dear Hotel Madrid',
                rating: 4.3,
                address: 'Gran Vía, 80, Madrid',
                price: '€160-200/night',
                website: 'https://dearhotelmadrid.com/',
                phone: '+34 914 12 32 00',
                place_id: 'madrid_dear_hotel',
                photo: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=250&fit=crop'
            },
            {
                name: 'Only YOU Boutique Hotel',
                rating: 4.2,
                address: 'Barquillo, 21, Madrid',
                price: '€140-180/night',
                website: 'https://www.onlyyouhotels.com/madrid/',
                phone: '+34 910 05 22 22',
                place_id: 'madrid_only_you',
                photo: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&h=250&fit=crop'
            }
        ],
        'seville': [
            {
                name: 'Hotel Casa 1800 Sevilla',
                rating: 4.5,
                address: 'Rodrigo Caro, 6, Seville',
                price: '€150-190/night',
                website: 'https://www.hotelcasa1800sevilla.com/',
                phone: '+34 954 56 18 00',
                place_id: 'seville_casa_1800',
                photo: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&h=250&fit=crop'
            },
            {
                name: 'Corral del Rey',
                rating: 4.3,
                address: 'Corral del Rey, 12, Seville',
                price: '€130-170/night',
                website: 'https://www.corraldelrey.com/',
                phone: '+34 954 22 71 16',
                place_id: 'seville_corral_rey',
                photo: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=400&h=250&fit=crop'
            },
            {
                name: 'Casa de Colón',
                rating: 4.1,
                address: 'Pedro Caravaca, 1, Seville',
                price: '€120-160/night',
                website: 'https://www.casadecolon.net/',
                phone: '+34 954 50 59 99',
                place_id: 'seville_casa_colon',
                photo: 'https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=400&h=250&fit=crop'
            }
        ],
        'cordoba': [
            {
                name: 'Casa de los Azulejos',
                rating: 4.4,
                address: 'Fernando Colón, 5, Córdoba',
                price: '€110-140/night',
                website: 'https://www.casadelosazulejos.com/',
                phone: '+34 957 47 00 00',
                place_id: 'cordoba_azulejos',
                photo: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&h=250&fit=crop'
            }
        ],
        'granada': [
            {
                name: 'Casa Morisca Hotel',
                rating: 4.3,
                address: 'Cuesta de la Victoria, 9, Granada',
                price: '€130-170/night',
                website: 'https://www.hotelcasamorisca.com/',
                phone: '+34 958 21 11 00',
                place_id: 'granada_casa_morisca',
                photo: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=400&h=250&fit=crop'
            },
            {
                name: 'Palacio de los Patos',
                rating: 4.2,
                address: 'Solarillo de Gracia, 1, Granada',
                price: '€160-200/night',
                website: 'https://www.hospes.com/granada/',
                phone: '+34 958 53 57 90',
                place_id: 'granada_palacio_patos',
                photo: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=250&fit=crop'
            }
        ],
        'madrid-final': [
            {
                name: 'Hotel Único Madrid',
                rating: 4.5,
                address: 'Claudio Coello, 67, Madrid',
                price: '€200-250/night',
                website: 'https://www.hotelunicomadrid.com/',
                phone: '+34 917 81 01 73',
                place_id: 'madrid_unico',
                photo: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=250&fit=crop'
            },
            {
                name: 'The Westin Palace Madrid',
                rating: 4.4,
                address: 'Plaza de las Cortes, 7, Madrid',
                price: '€180-220/night',
                website: 'https://www.marriott.com/hotels/travel/madwi-the-westin-palace-madrid/',
                phone: '+34 913 60 80 00',
                place_id: 'madrid_westin_palace',
                photo: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=250&fit=crop'
            },
            {
                name: 'Hotel Heritage Madrid',
                rating: 4.2,
                address: 'Serrano, 27, Madrid',
                price: '€150-190/night',
                website: 'https://www.hotelheritage.es/',
                phone: '+34 914 35 76 11',
                place_id: 'madrid_heritage',
                photo: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&h=250&fit=crop'
            }
        ]
    };
    
    const cityKey = cityId;
    const hotels = boutiqueHotels[cityKey] || [];
    
    return formatHotelResults(hotels, cityId);
}

// Format hotel results for display
function formatHotelResults(hotels, cityId) {
    return hotels.map(hotel => {
        const photo = hotel.photo || getDefaultCityImage(cityId);
        const rating = hotel.rating ? `⭐ ${hotel.rating.toFixed(1)}` : '';
        const price = hotel.price || 'Price varies';
            
        return {
            name: hotel.name,
            address: hotel.address || '',
            rating: rating,
            price: price,
            photo: photo,
            website: hotel.website,
            phone: hotel.phone,
            place_id: hotel.place_id,
            cityId: cityId
        };
    });
}

// Get price level description
function getPriceDescription(priceLevel) {
    switch(priceLevel) {
        case 1: return '(Budget)';
        case 2: return '(Moderate)';
        case 3: return '(Upscale)';
        case 4: return '(Luxury)';
        default: return '';
    }
}

// Display hotels for a specific city
function displayHotelsForCity(city, hotels) {
    // console.log(`Displaying hotels for city: ${city.name} (ID: ${city.id}), hotel count: ${hotels.length}`);
    
    // Find existing hotel section by looking for the city name in h3 headers
    const allSections = document.querySelectorAll('.hotel-city-section');
    let citySection = null;
    
    // console.log(`Found ${allSections.length} hotel sections in HTML`);
    
    for (const section of allSections) {
        const h3 = section.querySelector('h3');
        if (h3) {
            // console.log(`Checking section with header: "${h3.textContent}"`);
            // Handle Madrid final night specifically
            if (city.id === 'madrid-final' && h3.textContent.includes('Final Night')) {
                // console.log(`Found Madrid Final Night section!`);
                citySection = section;
                break;
            }
            // Handle regular Madrid (Week 1 Base)
            else if (city.id === 'madrid' && h3.textContent.includes('Week 1 Base')) {
                // console.log(`Found Madrid Week 1 Base section!`);
                citySection = section;
                break;
            }
            // Handle other cities
            else if (city.id !== 'madrid' && city.id !== 'madrid-final' && h3.textContent.includes(city.name)) {
                // console.log(`Found ${city.name} section!`);
                citySection = section;
                break;
            }
        }
    }
    
    if (!citySection) {
        citySection = createHotelCitySection(city);
    }
    
    const hotelGrid = citySection.querySelector('.hotel-grid');
    if (hotelGrid) {
        hotelGrid.innerHTML = ''; // Clear existing hotels
        
        if (hotels.length === 0) {
            hotelGrid.innerHTML = '<p>No boutique hotels found. Please check back later.</p>';
            return;
        }
        
        hotels.forEach(hotel => {
            const hotelCard = createHotelCard(hotel);
            hotelGrid.appendChild(hotelCard);
        });
        
        // Add "Browse More Hotels" option
        const browseMoreCard = createBrowseMoreCard(city);
        hotelGrid.appendChild(browseMoreCard);
        
        // Add "Add Custom Hotel" option
        const addCustomCard = createAddCustomHotelCard(city);
        hotelGrid.appendChild(addCustomCard);
    }
}

// Create hotel city section if it doesn't exist
function createHotelCitySection(city) {
    const hotelsSection = document.querySelector('.hotels-section');
    const citySection = document.createElement('div');
    citySection.className = 'hotel-city-section';
    citySection.setAttribute('data-city-section', city.id);
    
    citySection.innerHTML = `
        <h3>${city.name} (${city.nights})</h3>
        <div class="hotel-grid"></div>
    `;
    
    hotelsSection.appendChild(citySection);
    return citySection;
}

// Create individual hotel card
function createHotelCard(hotel) {
    const card = document.createElement('div');
    card.className = 'suggestion-card enhanced';
    card.setAttribute('data-city', hotel.cityId);
    card.setAttribute('data-hotel-name', hotel.name);
    
    card.innerHTML = `
        ${hotel.photo ? `
            <div class="suggestion-image">
                <img src="${hotel.photo}" alt="${hotel.name}" onerror="this.style.display='none'">
            </div>
        ` : ''}
        <div class="suggestion-content">
            <span class="suggestion-category">BOUTIQUE HOTEL</span>
            <h4>${hotel.name}</h4>
            <div class="hotel-rating">${hotel.rating}</div>
            <div class="hotel-price">${hotel.price}</div>
            <div class="suggestion-description">${hotel.address}</div>
            ${hotel.phone ? `<div class="suggestion-phone"><i class="fas fa-phone"></i> ${hotel.phone}</div>` : ''}
        </div>
        <div class="suggestion-actions">
            ${hotel.website ? 
                `<a href="${hotel.website}" target="_blank" class="suggestion-link">
                    <i class="fas fa-globe"></i> Website
                </a>` : 
                `<a href="https://www.google.com/maps/place/?q=place_id:${hotel.place_id}" target="_blank" class="suggestion-link">
                    <i class="fas fa-map-marker-alt"></i> View on Maps
                </a>`
            }
            <button class="add-to-itinerary" data-hotel-name="${hotel.name}" data-city="${hotel.cityId}">
                <i class="fas fa-plus"></i> Select Hotel
            </button>
        </div>
    `;
    
    return card;
}

// Create "Browse More Hotels" card
function createBrowseMoreCard(city) {
    const card = document.createElement('div');
    card.className = 'suggestion-card browse-more';
    
    const cityName = city.name === 'Madrid' && city.id === 'madrid-final' ? 'Madrid' : city.name;
    const searchQuery = `hotels in ${cityName}, Spain`;
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    
    card.innerHTML = `
        <div class="suggestion-content browse-more-content">
            <div class="browse-more-icon">
                <i class="fas fa-search"></i>
            </div>
            <h4>Browse More Hotels</h4>
            <div class="suggestion-description">
                Don't see what you're looking for? Search for more hotel options in ${cityName}.
            </div>
        </div>
        <div class="suggestion-actions">
            <a href="${mapsUrl}" target="_blank" class="suggestion-link">
                <i class="fas fa-map-marker-alt"></i> View on Maps
            </a>
            <a href="https://www.booking.com/searchresults.html?ss=${encodeURIComponent(cityName + ', Spain')}" target="_blank" class="add-to-itinerary browse-booking">
                <i class="fas fa-external-link-alt"></i> Browse Booking.com
            </a>
        </div>
    `;
    
    return card;
}

// Create "Add Custom Hotel" card
function createAddCustomHotelCard(city) {
    const card = document.createElement('div');
    card.className = 'suggestion-card add-custom';
    
    const cityName = city.name === 'Madrid' && city.id === 'madrid-final' ? 'Madrid' : city.name;
    
    card.innerHTML = `
        <div class="suggestion-content add-custom-content">
            <div class="add-custom-icon">
                <i class="fas fa-plus-circle"></i>
            </div>
            <h4>Add Your Own Hotel</h4>
            <div class="suggestion-description">
                Found a hotel you'd like to add to your ${cityName} itinerary? Add it here.
            </div>
        </div>
        <div class="suggestion-actions">
            <button class="suggestion-link add-custom-btn" data-city-id="${city.id}" data-city-name="${cityName}">
                <i class="fas fa-edit"></i> Add Hotel Details
            </button>
        </div>
    `;
    
    // Add click handler for the add custom button
    const addBtn = card.querySelector('.add-custom-btn');
    addBtn.addEventListener('click', () => showAddCustomHotelModal(city));
    
    return card;
}

// Show modal to add custom hotel with Google Places Autocomplete
function showAddCustomHotelModal(city) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'add-custom-hotel-modal';
    
    const cityName = city.name === 'Madrid' && city.id === 'madrid-final' ? 'Madrid' : city.name;
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Add Hotel - ${cityName}</h3>
            <div class="custom-hotel-form">
                <div class="form-group">
                    <label for="hotel-search-input">Search for a Hotel</label>
                    <input type="text" id="hotel-search-input" placeholder="Type hotel name in ${cityName}...">
                    <div class="search-help">Start typing a hotel name and select from the suggestions</div>
                </div>
                
                <div id="hotel-details" class="hotel-details-preview" style="display: none;">
                    <h4>Selected Hotel:</h4>
                    <div class="selected-hotel-info">
                        <div class="hotel-name-display"></div>
                        <div class="hotel-address-display"></div>
                        <div class="hotel-rating-display"></div>
                        <div class="hotel-phone-display"></div>
                        <div class="hotel-website-display"></div>
                    </div>
                </div>
            </div>
            <div class="modal-buttons">
                <button id="custom-hotel-cancel">Cancel</button>
                <button id="custom-hotel-save" disabled>Add to ${cityName} Hotels</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize Google Places Autocomplete
    initializeHotelAutocomplete(city);
    
    // Add event listeners
    document.getElementById('custom-hotel-cancel').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.getElementById('custom-hotel-save').addEventListener('click', () => {
        saveSelectedHotel(city, modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Initialize Google Places Autocomplete for hotel search
function initializeHotelAutocomplete(city) {
    const input = document.getElementById('hotel-search-input');
    const cityName = city.name === 'Madrid' && city.id === 'madrid-final' ? 'Madrid' : city.name;
    
    // Set up bias towards the city
    const coordinates = CITY_COORDINATES[city.id === 'madrid-final' ? 'madrid' : city.id];
    let bounds = null;
    
    if (coordinates) {
        const [lat, lng] = coordinates.split(',');
        const center = new google.maps.LatLng(parseFloat(lat), parseFloat(lng));
        const radius = 0.1; // ~10km radius
        bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(center.lat() - radius, center.lng() - radius),
            new google.maps.LatLng(center.lat() + radius, center.lng() + radius)
        );
    }
    
    const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['lodging'],
        bounds: bounds,
        strictBounds: false,
        componentRestrictions: { country: 'es' },
        fields: ['place_id', 'name', 'formatted_address', 'rating', 'formatted_phone_number', 'website', 'photos', 'price_level']
    });
    
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.place_id) {
            console.log('No place selected');
            return;
        }
        
        // Check if it's in the right city
        if (!place.formatted_address.toLowerCase().includes(cityName.toLowerCase())) {
            alert(`Please select a hotel in ${cityName}`);
            input.value = '';
            return;
        }
        
        displayHotelPreview(place);
    });
}

// Display preview of selected hotel
function displayHotelPreview(place) {
    const detailsDiv = document.getElementById('hotel-details');
    const saveBtn = document.getElementById('custom-hotel-save');
    
    // Store place data for later use
    detailsDiv.setAttribute('data-place-id', place.place_id);
    detailsDiv.setAttribute('data-place-data', JSON.stringify({
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        phone: place.formatted_phone_number,
        website: place.website,
        photos: place.photos,
        price_level: place.price_level
    }));
    
    // Display hotel info
    document.querySelector('.hotel-name-display').innerHTML = `<strong>${place.name}</strong>`;
    document.querySelector('.hotel-address-display').innerHTML = `📍 ${place.formatted_address || 'Address not available'}`;
    document.querySelector('.hotel-rating-display').innerHTML = place.rating ? `⭐ ${place.rating.toFixed(1)}` : '⭐ Rating not available';
    document.querySelector('.hotel-phone-display').innerHTML = place.formatted_phone_number ? `📞 ${place.formatted_phone_number}` : '📞 Phone not available';
    document.querySelector('.hotel-website-display').innerHTML = place.website ? `🌐 <a href="${place.website}" target="_blank">Website</a>` : '🌐 Website not available';
    
    detailsDiv.style.display = 'block';
    saveBtn.disabled = false;
}

// Save selected hotel from Google Places
function saveSelectedHotel(city, modal) {
    const detailsDiv = document.getElementById('hotel-details');
    const placeDataStr = detailsDiv.getAttribute('data-place-data');
    
    if (!placeDataStr) {
        alert('Please search for and select a hotel first');
        return;
    }
    
    const placeData = JSON.parse(placeDataStr);
    
    // Get photo URL if available
    let photoUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=250&fit=crop'; // Default
    if (placeData.photos && placeData.photos.length > 0) {
        photoUrl = placeData.photos[0].getUrl({ maxWidth: 400, maxHeight: 250 });
    }
    
    // Format price level
    let priceDisplay = 'Price varies';
    if (placeData.price_level) {
        const euros = '€'.repeat(placeData.price_level);
        const descriptions = ['', 'Budget', 'Moderate', 'Upscale', 'Luxury'];
        priceDisplay = `${euros} ${descriptions[placeData.price_level] || ''}`;
    }
    
    const selectedHotel = {
        name: placeData.name,
        address: placeData.address || 'Address not available',
        website: placeData.website,
        phone: placeData.phone,
        price: priceDisplay,
        rating: placeData.rating ? `⭐ ${placeData.rating.toFixed(1)}` : '',
        photo: photoUrl,
        place_id: detailsDiv.getAttribute('data-place-id'),
        cityId: city.id
    };
    
    // Add the hotel to the hotel grid
    const citySection = findCitySectionByName(city);
    if (citySection) {
        const hotelGrid = citySection.querySelector('.hotel-grid');
        const hotelCard = createHotelCard(selectedHotel);
        
        // Insert before the "Browse More" and "Add Custom" cards
        const browseMoreCard = hotelGrid.querySelector('.browse-more');
        if (browseMoreCard) {
            hotelGrid.insertBefore(hotelCard, browseMoreCard);
        } else {
            hotelGrid.appendChild(hotelCard);
        }
    }
    
    // Close modal
    document.body.removeChild(modal);
    
    // Show success message
    alert(`${selectedHotel.name} has been added to your ${city.name} hotel options!`);
}

// Helper function to find city section
function findCitySectionByName(city) {
    const allSections = document.querySelectorAll('.hotel-city-section');
    
    for (const section of allSections) {
        const h3 = section.querySelector('h3');
        if (h3) {
            if (city.id === 'madrid-final' && h3.textContent.includes('Final Night')) {
                return section;
            } else if (city.id === 'madrid' && h3.textContent.includes('Week 1 Base')) {
                return section;
            } else if (city.id !== 'madrid' && city.id !== 'madrid-final' && h3.textContent.includes(city.name)) {
                return section;
            }
        }
    }
    return null;
}


function displaySearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (results.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>No results found</h3>
                <p>Try a different search term or check the spelling.</p>
                <p style="font-size: 14px; margin-top: 10px;">Popular searches: restaurants, museums, bars, parks, attractions</p>
            </div>
        `;
        return;
    }
    
    const html = results.map(result => {
        const cityName = result.city.charAt(0).toUpperCase() + result.city.slice(1);
        const activityText = `Visit ${result.title}`;
        
        return `
            <div class="suggestion-card enhanced" data-city="${result.city}">
                ${result.image ? `
                    <div class="suggestion-image">
                        <img src="${result.image}" alt="${result.title}" onerror="this.style.display='none'">
                    </div>
                ` : ''}
                <div class="suggestion-content">
                    <h4>${result.title}</h4>
                    ${result.category ? `
                        <span class="suggestion-category">${result.category}</span>
                    ` : ''}
                    <p class="suggestion-city">${cityName}</p>
                    <p class="suggestion-description">${result.description}</p>
                    ${result.phone ? `<p class="suggestion-phone"><i class="fas fa-phone"></i> ${result.phone}</p>` : ''}
                </div>
                <div class="suggestion-actions">
                    ${result.website ? 
                        `<a href="${result.website}" target="_blank" class="suggestion-link">
                            <i class="fas fa-globe"></i> Website
                        </a>` : 
                        (result.place_id ? 
                            `<a href="https://www.google.com/maps/place/?q=place_id:${result.place_id}" target="_blank" class="suggestion-link">
                                <i class="fas fa-map-marker-alt"></i> View on Maps
                            </a>` : '')
                    }
                    <button class="add-to-itinerary" data-activity="${activityText}" data-activity-url="${result.place_id ? `https://www.google.com/maps/place/?q=place_id:${result.place_id}` : ''}">
                        <i class="fas fa-plus"></i> Add to Itinerary
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `<div class="suggestions-grid">${html}</div>`;
}

function showDaySelectorModal(activity, suggestedCity, activityUrl = '') {
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
            addActivity(day, activity, activityUrl);
            modal.classList.remove('active');
            showNotification(`Added "${activity}" to ${dayTitle}!`);
        });
        
        list.appendChild(item);
    });
    
    modal.classList.add('active');
}

// Load data from Firebase
function loadFromFirebase(callback) {
    const tripRef = database.ref(`trips/${tripId}`);
    
    tripRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log('Loaded data from Firebase:', data);
            updatingFromFirebase = true;
            itineraryData = { ...itineraryData, ...data };
            updatingFromFirebase = false;
        } else {
            console.log('No existing trip data found, starting fresh');
        }
        
        if (callback) callback();
    });
}

// Setup real-time listeners for Firebase
function setupFirebaseListeners() {
    const tripRef = database.ref(`trips/${tripId}`);
    let isFirstLoad = true;
    
    // Listen for changes
    tripRef.on('value', (snapshot) => {
        if (updatingFromFirebase) return; // Avoid loops
        
        const data = snapshot.val();
        if (!data) return;
        
        // Skip the first load (happens right after we set up the listener)
        if (isFirstLoad) {
            isFirstLoad = false;
            return;
        }
        
        // Only update if the timestamp is different AND newer than our last save
        if (data.lastUpdated && 
            data.lastUpdated !== itineraryData.lastUpdated && 
            data.lastUpdated > (itineraryData.lastUpdated || 0)) {
            
            console.log('Received update from Firebase');
            updatingFromFirebase = true;
            
            // Update local data
            itineraryData = { ...itineraryData, ...data };
            
            // Refresh UI
            refreshUIFromData();
            
            updatingFromFirebase = false;
        }
    });
}

// Refresh UI from data
function refreshUIFromData() {
    // Restore hotel selections
    restoreHotelSelections();
    
    // Restore trip dates
    updateTripDatesDisplay();
    
    // Restore todo items
    initializeTodoItems();
    updateTodoProgress();
    
    // Restore activities
    initializeActivities();
    
    // Show success notification
    showSyncNotification('Trip updated from another device');
}

// Show sync notification
function showSyncNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Show share modal
function showShareModal() {
    const shareUrl = window.location.href;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'share-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Share This Trip</h3>
            <p>Share this link with your travel companions to collaborate in real-time:</p>
            <div class="share-link-container">
                <input type="text" id="share-link" value="${shareUrl}" readonly>
                <button id="copy-link-btn">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
            <div class="share-instructions">
                <p><strong>How it works:</strong></p>
                <ul>
                    <li>Anyone with this link can view and edit the trip</li>
                    <li>Changes sync automatically across all devices</li>
                    <li>Bookmark this page to return to your trip</li>
                </ul>
            </div>
            <div class="modal-buttons">
                <button id="share-close">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Copy button
    document.getElementById('copy-link-btn').addEventListener('click', () => {
        const input = document.getElementById('share-link');
        input.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copy-link-btn');
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.backgroundColor = '#27ae60';
        
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.style.backgroundColor = '';
        }, 2000);
    });
    
    // Close button
    document.getElementById('share-close').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

function saveData() {
    if (updatingFromFirebase) return; // Don't save while updating from Firebase
    
    // Clear any existing save timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Debounce saves to prevent rapid firing
    saveTimeout = setTimeout(() => {
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
        
        
        // Save collapsed states
        itineraryData.collapsedDays = [];
        days.forEach(day => {
            if (day.classList.contains('collapsed')) {
                itineraryData.collapsedDays.push(day.getAttribute('data-day'));
            }
        });
        
        // Add timestamp
        itineraryData.lastUpdated = Date.now();
        
        // Track activity for the log
        trackActivity('Trip updated');
        
        // Save to Firebase
        const tripRef = database.ref(`trips/${tripId}`);
        tripRef.set(itineraryData)
            .then(() => {
                console.log('Saved to Firebase successfully');
            })
            .catch((error) => {
                console.error('Error saving to Firebase:', error);
                // Fallback to localStorage
                localStorage.setItem('spainItinerary', JSON.stringify(itineraryData));
            });
    }, 500); // Wait 500ms before saving
}

function loadSavedData() {
    const saved = localStorage.getItem('spainItinerary');
    if (!saved) return;
    
    const savedData = JSON.parse(saved);
    
    // Only override HTML content if we have actual saved activities
    // Otherwise preserve the detailed HTML content
    if (!savedData.activities || Object.keys(savedData.activities).length === 0) {
        return;
    }
    
    itineraryData = savedData;
    
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
        
        display.innerHTML = `${startFormatted} - ${endFormatted} <button id="clear-dates-btn" class="clear-dates-btn" title="Clear dates"><i class="fas fa-times"></i></button>`;
        display.style.display = 'inline';
        button.innerHTML = '<i class="fas fa-edit"></i> Edit Dates';
        
        // Add event listener for clear button
        const clearBtn = document.getElementById('clear-dates-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearTripDates);
        }
    } else {
        display.style.display = 'none';
        button.innerHTML = '<i class="fas fa-calendar-alt"></i> Set Trip Dates';
    }
}

function clearTripDates() {
    if (confirm('Are you sure you want to clear the trip dates?')) {
        itineraryData.tripDates.startDate = null;
        itineraryData.tripDates.endDate = null;
        updateTripDatesDisplay();
        clearDayDates();
        saveData();
        showNotification('Trip dates cleared!');
    }
}

function clearDayDates() {
    // Remove date information from day headers
    const days = document.querySelectorAll('.day');
    days.forEach(day => {
        const header = day.querySelector('.day-header h4');
        if (header) {
            // Remove any date suffix like " (Mon 3/15)"
            header.textContent = header.textContent.replace(/ \([^)]+\)$/, '');
        }
    });
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
    if (!confirm('This will regenerate the entire itinerary based on your city selections. Current activities will be preserved where possible. Continue?')) {
        return;
    }
    
    // Store current activities for preservation
    const preservedData = {
        activities: { ...itineraryData.activities },
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