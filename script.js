document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration and State ---
    const DEFAULT_USER = 'user123';
    const DEFAULT_PASS = '1234';
    const AUTH_TOKEN = 'bookify_user_session_f7g9h2j4k6l8m0n1';
    const HOME_DEFAULT_QUERY = 'subject:literature'; 
    const API_URL = 'https://www.googleapis.com/books/v1/volumes?q=';
    
    // Application State
    let loggedIn = localStorage.getItem("loggedInToken") === AUTH_TOKEN; 
    let selectedBook = null; 
    let favorites = JSON.parse(localStorage.getItem("favorites")) || {}; 
    
    // Load existing users or initialize with the default user
    let appUsers = JSON.parse(localStorage.getItem("appUsers")) || {};
    if (!appUsers[DEFAULT_USER]) {
        appUsers[DEFAULT_USER] = { password: DEFAULT_PASS, isDefault: true };
        localStorage.setItem("appUsers", JSON.stringify(appUsers));
    }


    // --- DOM Elements ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
    const signupScreen = document.getElementById('signup-screen');
    const signupForm = document.getElementById('signup-form');
    const goToSignupBtn = document.getElementById('go-to-signup');
    const goToLoginBtn = document.getElementById('go-to-login');

    const allScreens = document.querySelectorAll('.screen');
    const navItems = document.querySelectorAll('.bottom-navbar .nav-item');
    const homeBookList = document.getElementById('home-book-list');
    const favoritesBookList = document.getElementById('favorites-book-list');
    const searchBookList = document.getElementById('search-book-list');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const backButton = document.getElementById('back-button');
    const noFavoritesMessage = document.getElementById('no-favorites-message');

    // --- Utility Functions ---

    /**
     * Toggles screen visibility (SPA core).
     */
    const showScreen = (screenId) => {
        allScreens.forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');

        // Handle Navbar visibility and active state
        const navbar = document.querySelector('.bottom-navbar');
        if (screenId === 'login-screen' || screenId === 'signup-screen' || screenId === 'details-screen') {
            navbar.style.display = 'none';
        } else {
            navbar.style.display = 'flex';
            navItems.forEach(item => item.classList.remove('active'));
            const targetNav = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
            if (targetNav) {
                targetNav.classList.add('active');
            }
        }

        // Specific Screen Logic
        if (screenId === 'favorites-screen') {
            renderFavorites();
        } else if (screenId === 'profile-screen') {
            setupProfileScreen();
        }
    };

    const saveUsers = () => {
        localStorage.setItem("appUsers", JSON.stringify(appUsers));
    };

    const saveFavorites = () => {
        localStorage.setItem("favorites", JSON.stringify(favorites));
    };

    /**
     * Renders the Star Rating GUI.
     */
    const getRatingHTML = (rating, interactive = false, id = null) => {
        const validRating = rating !== null ? Math.min(5, Math.max(0, parseFloat(rating))) : 0;
        let stars = '';

        for (let i = 1; i <= 5; i++) {
            let iconClass = 'far';
            if (i <= Math.floor(validRating)) {
                iconClass = 'fas';
            } else if (i - 0.5 <= validRating && i > Math.floor(validRating)) {
                 iconClass = 'fas fa-star-half-alt';
            }
            
            const isHalf = iconClass === 'fas fa-star-half-alt';
            // Use 'fa-star' for all full/empty states for consistency with interactive styles
            const starClass = isHalf ? 'fas fa-star-half-alt' : `${iconClass} fa-star`;
            
            stars += `<i class="${starClass} ${interactive ? 'rating-star' : ''}" data-value="${i}" data-book-id="${id}"></i>`;
        }

        return `<div class="stars-container ${interactive ? 'stars-large interactive-rating' : ''}">
            ${stars}
            ${!interactive && rating === 0 && validRating === 0 ? `<span class="no-rating">N/A</span>` : ''}
        </div>`;
    };
    
    // --- API and Rendering ---

    const fetchAndRenderBooks = async (query, targetElement) => {
        if(targetElement.id === 'home-book-list') {
             document.getElementById('search-results-label').textContent = 'Search Results';
        }
        
        targetElement.innerHTML = '';
        
        let spinner = targetElement.querySelector('.loading-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            targetElement.appendChild(spinner);
        }
        spinner.classList.add('show');

        try {
            const response = await fetch(`${API_URL}${encodeURIComponent(query)}&maxResults=20`);
            const data = await response.json();
            
            spinner.classList.remove('show');

            const books = data.items || [];
            if (books.length > 0) {
                targetElement.innerHTML = '';
                books.forEach(item => {
                    if (item.volumeInfo && item.volumeInfo.title) {
                        const book = formatBookData(item);
                        targetElement.appendChild(createBookCard(book, true));
                    }
                });
            } else {
                targetElement.innerHTML = `<p class="info-message">No books found for your query.</p>`;
            }

        } catch (error) {
            console.error('API Fetch Error:', error);
            spinner.classList.remove('show');
            targetElement.innerHTML = '<p class="info-message">Failed to load data. Check network connection.</p>';
        }
    };

    const formatBookData = (item) => {
        const info = item.volumeInfo;
        const id = item.id;
        return {
            id: id,
            title: info.title || 'Unknown Title',
            author: info.authors ? info.authors.join(', ') : 'Unknown Author',
            image: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail) : 'placeholder.png',
            description: info.description || 'No description available for this book.',
            // Prioritize user's personal rating if available
            rating: favorites[id] && favorites[id].personalRating !== undefined ? favorites[id].personalRating : (info.averageRating || null),
            apiRating: info.averageRating || null,
            ratingsCount: info.ratingsCount || 0
        };
    };

    const createBookCard = (book, isHomeOrSearch) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.id = book.id;

        const isFavorited = !!favorites[book.id];

        let actionButtons = '';
        if (isHomeOrSearch) {
            actionButtons = `
                <button class="details-btn" data-id="${book.id}">Details</button>
                <button class="fav-btn fas ${isFavorited ? 'fa-heart active' : 'fa-regular fa-heart'}" data-id="${book.id}"></button>
            `;
        } else {
            actionButtons = `
                <button class="details-btn" data-id="${book.id}">Details</button>
                <button class="remove-btn" data-id="${book.id}">Remove</button>
            `;
        }

        card.innerHTML = `
            <img class="book-card-img" src="${book.image}" alt="${book.title}" onerror="this.src='placeholder.png'">
            <div class="book-info">
                <h4>${book.title}</h4>
                <p>${book.author}</p>
                ${getRatingHTML(book.rating)}
            </div>
            <div class="book-actions">
                ${actionButtons}
            </div>
        `;
        
        card.querySelector('.details-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            // Ensure we pass the most current data (from favorites if present, otherwise fetched data)
            showBookDetails(favorites[book.id] || book);
        });
        
        if (isHomeOrSearch) {
            card.querySelector('.fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(book, e.currentTarget);
            });
        } else {
            card.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFavorite(book.id);
            });
        }
        
        return card;
    };

    // --- Favorites Logic ---

    const toggleFavorite = (book, button) => {
        const id = book.id;
        let isAdding;
        
        if (favorites[id]) {
            delete favorites[id];
            isAdding = false;
        } else {
            favorites[id] = { 
                ...book,
                personalRating: favorites[id] ? favorites[id].personalRating : undefined
            };
            isAdding = true;
        }
        saveFavorites();
        
        if (button) {
            button.classList.toggle('fa-heart', isAdding);
            button.classList.toggle('fa-regular', !isAdding);
            button.classList.toggle('active', isAdding);
        }

        const detailFavBtn = document.getElementById('detail-favorite-btn');
        if (document.getElementById('details-screen').classList.contains('active') && selectedBook && selectedBook.id === id) {
             detailFavBtn.textContent = isAdding ? 'Remove from Favorites ❤️' : 'Add to Favorites ❤️';
             detailFavBtn.classList.toggle('btn-secondary-active', isAdding);
        }
        
        if (document.getElementById('favorites-screen').classList.contains('active')) {
             renderFavorites();
        }
        setupProfileScreen();
    };

    const removeFavorite = (id) => {
        if (favorites.hasOwnProperty(id)) {
            delete favorites[id];
            saveFavorites();
        }
        
        const homeButton = document.querySelector(`.fav-btn[data-id="${id}"]`);
        if (homeButton) {
            homeButton.classList.remove('fa-heart', 'active');
            homeButton.classList.add('fa-regular', 'fa-heart');
        }

        renderFavorites();
        setupProfileScreen();
    };

    const renderFavorites = () => {
        favoritesBookList.innerHTML = '';
        const favoriteBooksArray = Object.values(favorites);
        
        if (favoriteBooksArray.length === 0) {
            noFavoritesMessage.classList.remove('hidden');
        } else {
            noFavoritesMessage.classList.add('hidden');
            favoriteBooksArray.forEach(book => {
                favoritesBookList.appendChild(createBookCard(book, false));
            });
        }
    };

    const setUserRating = (bookId, ratingValue) => {
        if (!favorites[bookId]) {
            alert("Please add the book to favorites first to save your personal rating!");
            return;
        }

        if (favorites[bookId]) {
             favorites[bookId].personalRating = ratingValue;
             saveFavorites();
             showBookDetails(favorites[bookId]); 
        }

        setupProfileScreen();
    };


    // --- Details and Profile Logic ---

    const showBookDetails = (book) => {
        selectedBook = book; 

        document.getElementById('detail-image').src = book.image;
        document.getElementById('detail-title').textContent = book.title;
        document.getElementById('detail-author').textContent = book.author;
        document.getElementById('detail-description').textContent = book.description;
        
        const personalRating = favorites[book.id] ? favorites[book.id].personalRating : undefined;
        const currentRating = personalRating !== undefined ? personalRating : book.apiRating;

        // Interactive Rating GUI Setup
        document.getElementById('detail-rating-stars').innerHTML = getRatingHTML(currentRating, true, book.id);

        document.getElementById('detail-rating-text').textContent = 
            `Your rating: ${personalRating || 'Unrated'} / API: ${book.apiRating || 'N/A'}`;
        
        // Add event listeners to the new interactive stars
        document.querySelectorAll('#detail-rating-stars .rating-star').forEach(star => {
            star.addEventListener('click', (e) => {
                const rating = parseInt(e.currentTarget.dataset.value);
                const id = e.currentTarget.dataset.bookId;
                setUserRating(id, rating);
            });
        });

        // Favorite Button Logic
        const favBtn = document.getElementById('detail-favorite-btn');
        const isFav = !!favorites[book.id];
        
        favBtn.textContent = isFav ? 'Remove from Favorites ❤️' : 'Add to Favorites ❤️';
        favBtn.classList.toggle('btn-secondary-active', isFav);

        favBtn.onclick = () => {
            const heartButton = document.querySelector(`.fav-btn[data-id="${book.id}"]`);
            toggleFavorite(book, heartButton);
            showBookDetails(book);
        };

        showScreen('details-screen');
    };

    const setupProfileScreen = () => {
        const username = localStorage.getItem('currentUsername') || DEFAULT_USER;
        document.getElementById('profile-username').textContent = username;
        
        // Calculate Statistics
        const allFavs = Object.values(favorites);
        const totalFavs = allFavs.length;
        const totalRated = allFavs.filter(b => b.personalRating !== undefined && b.personalRating !== null).length;

        document.getElementById('profile-avatar').src = 
            `https://api.dicebear.com/9.x/avataaars/svg?seed=${username}&radius=50&backgroundColor=06b6d4,22c55e`;
        
        document.querySelector('#profile-screen #stat-favorites').textContent = totalFavs;
        document.querySelector('#profile-screen #stat-rated').textContent = totalRated;
    };
    
    // --- Authentication and Navigation Handlers ---

    // 1. Login Logic
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const user = appUsers[username];

        if (user && user.password === password) {
            localStorage.setItem("loggedInToken", AUTH_TOKEN); 
            localStorage.setItem("currentUsername", username);
            loggedIn = true;
            loginScreen.classList.remove('active');
            appContainer.style.display = 'block';
            showScreen('home-screen');
            fetchAndRenderBooks(HOME_DEFAULT_QUERY, homeBookList);
        } else {
            alert("Invalid username or password");
        }
    });

    // Sign Up Logic
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;

        if (appUsers[username]) {
            alert("Username already taken! Please choose another.");
            return;
        }

        if (password.length < 4) {
             alert("Password must be at least 4 characters long.");
             return;
        }

        appUsers[username] = { password: password };
        saveUsers();
        alert(`Account created for ${username}! Please log in.`);
        
        document.getElementById('username').value = username;
        document.getElementById('password').value = '';
        signupForm.reset();
        showScreen('login-screen');
    });

    // Navigation between Auth Screens
    goToSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('signup-screen');
    });

    goToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('login-screen');
    });


    // 6. Logout Logic
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem("loggedInToken");
        localStorage.removeItem("currentUsername");
        loggedIn = false;
        appContainer.style.display = 'none';
        showScreen('login-screen');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });

    // 7. Navigation Bar Logic
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screenId = item.dataset.screen;
            showScreen(screenId);
        });
    });

    // 5. Back Button Logic
    backButton.addEventListener('click', () => {
        showScreen('home-screen'); 
    });

    // 3. Search Logic
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            document.getElementById('search-results-label').textContent = `Results for: "${query}"`;
            fetchAndRenderBooks(query, searchBookList);
        } else {
            searchBookList.innerHTML = '<p class="info-message">Please enter a search term.</p>';
            document.getElementById('search-results-label').textContent = `Search Results`;
        }
    });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchButton.click();
        }
    });


    // --- Initialization on Load ---
    if (loggedIn) {
        loginScreen.classList.remove('active');
        appContainer.style.display = 'block';
        showScreen('home-screen');
        fetchAndRenderBooks(HOME_DEFAULT_QUERY, homeBookList);
    } else {
        loginScreen.classList.add('active');
        appContainer.style.display = 'none';
        showScreen('login-screen');
    }
});