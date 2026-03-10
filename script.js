/* ============================================
   VisionX - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
    // Initialize all functions
    initNavbar();
    initMobileMenu();
    initSmoothScroll();
    initCountdown();
    initScrollReveal();
    initLeadPhotos();
    initReels();
    initPreEventsScroll();
});

/* ============================================
   Lead Photos - Handle Missing Images
   ============================================ */
function initLeadPhotos() {
    const leadPhotos = document.querySelectorAll('.lead-photo img');

    leadPhotos.forEach(img => {
        // When image loads successfully, hide placeholder
        img.onload = function () {
            this.style.display = 'block';
            const placeholder = this.nextElementSibling;
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        };

        // When image fails to load, show placeholder
        img.onerror = function () {
            this.style.display = 'none';
            const placeholder = this.nextElementSibling;
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        };

        // Check if image is already loaded (cached)
        if (img.complete) {
            if (img.naturalHeight > 0) {
                img.style.display = 'block';
                const placeholder = img.nextElementSibling;
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            } else {
                img.style.display = 'none';
            }
        }
    });
}

/* ============================================
   Reels Video Player - Auto Play
   ============================================ */
function initReels() {
    const reelItems = document.querySelectorAll('.reel-item');

    // Use Intersection Observer to play videos when visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (video) {
                if (entry.isIntersecting) {
                    video.play().catch(() => { });
                } else {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.5 });

    reelItems.forEach(item => {
        const video = item.querySelector('video');

        if (!video) return;

        // Observe each reel item
        observer.observe(item);

        // Try to play video on load
        video.onloadeddata = function () {
            video.play().catch(() => { });
        };

        // Click to toggle mute/unmute
        item.addEventListener('click', function () {
            video.muted = !video.muted;
        });
    });
}

/* ============================================
   Navbar Scroll Effect
   ============================================ */
function initNavbar() {
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

/* ============================================
   Mobile Menu Toggle
   ============================================ */
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links a');

    hamburger.addEventListener('click', function () {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking a link
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
        if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

/* ============================================
   Smooth Scroll for Anchor Links
   ============================================ */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            if (href === '#') return;

            e.preventDefault();

            const target = document.querySelector(href);
            if (target) {
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ============================================
   Countdown Timer
   ============================================ */
function initCountdown() {
    // Set the target date - April 04, 2026 at 5:00 PM
    const targetDate = new Date('April 04, 2026 17:00:00').getTime();

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            // Event has passed
            daysEl.textContent = '00';
            hoursEl.textContent = '00';
            minutesEl.textContent = '00';
            secondsEl.textContent = '00';
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysEl.textContent = formatTime(days);
        hoursEl.textContent = formatTime(hours);
        minutesEl.textContent = formatTime(minutes);
        secondsEl.textContent = formatTime(seconds);
    }

    function formatTime(time) {
        return time < 10 ? '0' + time : time;
    }

    // Update immediately
    updateCountdown();

    // Update every second
    setInterval(updateCountdown, 1000);
}

/* ============================================
   Scroll Reveal Animation
   ============================================ */
function initScrollReveal() {
    // Add reveal class to elements
    const revealElements = document.querySelectorAll(
        '.section-header, .about-text, .about-image, .event-card, .pre-event-card, .gallery-item, .stat, .director-content, .director-image-wrapper'
    );

    revealElements.forEach(el => {
        el.classList.add('reveal');
    });

    function checkReveal() {
        const windowHeight = window.innerHeight;
        const revealPoint = 150;

        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;

            if (elementTop < windowHeight - revealPoint) {
                element.classList.add('active');
            }
        });
    }

    // Check on load
    checkReveal();

    // Check on scroll
    window.addEventListener('scroll', checkReveal);
}

/* ============================================
   Additional Utility Functions
   ============================================ */

// Add loading animation
window.addEventListener('load', function () {
    document.body.classList.add('loaded');
});

// Parallax effect for hero (optional - subtle)
window.addEventListener('scroll', function () {
    const hero = document.querySelector('.hero');
    if (hero) {
        const scrolled = window.scrollY;
        hero.style.backgroundPositionY = scrolled * 0.5 + 'px';
    }
});

/* ============================================
   WhatsApp Registration Function
   ============================================ */
function openWhatsApp() {
    const phoneNumber = '919346315298';
    const message = 'Hi! I would like to register for VisionX Events (Cultural Day Concert & HR Excellence) on April 04 & 17, 2026.';
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

/* ============================================
   Pre-Events Horizontal Scroll
   ============================================ */
function initPreEventsScroll() {
    const scrollContainer = document.querySelector('.pre-events-scroll');
    const leftArrow = document.querySelector('.scroll-arrow.scroll-left');
    const rightArrow = document.querySelector('.scroll-arrow.scroll-right');
    const dots = document.querySelectorAll('.scroll-dot');
    const cards = document.querySelectorAll('.pre-events-scroll .pre-event-card');

    if (!scrollContainer || cards.length === 0) return;

    let currentIndex = 0;

    // Show only the active card
    function showCard(index) {
        cards.forEach((card, i) => {
            card.classList.remove('active', 'prev', 'next');

            if (i === index) {
                card.classList.add('active');
            } else if (i < index) {
                card.classList.add('prev');
            } else {
                card.classList.add('next');
            }
        });

        // Update dots
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        // Update arrows
        if (leftArrow) {
            leftArrow.style.opacity = index === 0 ? '0.3' : '1';
            leftArrow.style.pointerEvents = index === 0 ? 'none' : 'auto';
        }

        if (rightArrow) {
            rightArrow.style.opacity = index >= cards.length - 1 ? '0.3' : '1';
            rightArrow.style.pointerEvents = index >= cards.length - 1 ? 'none' : 'auto';
        }
    }

    // Navigate to specific card
    function goToCard(index) {
        if (index < 0) index = 0;
        if (index >= cards.length) index = cards.length - 1;

        currentIndex = index;
        showCard(currentIndex);
    }

    // Arrow click handlers
    if (leftArrow) {
        leftArrow.addEventListener('click', () => {
            goToCard(currentIndex - 1);
        });
    }

    if (rightArrow) {
        rightArrow.addEventListener('click', () => {
            goToCard(currentIndex + 1);
        });
    }

    // Dot click handlers
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            goToCard(index);
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const preEventsSection = document.getElementById('pre-events');
        const rect = preEventsSection.getBoundingClientRect();
        const isInView = rect.top < window.innerHeight && rect.bottom > 0;

        if (isInView) {
            if (e.key === 'ArrowLeft') {
                goToCard(currentIndex - 1);
            } else if (e.key === 'ArrowRight') {
                goToCard(currentIndex + 1);
            }
        }
    });

    // Touch/Swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    scrollContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    scrollContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (diff > swipeThreshold) {
            // Swiped left - go to next
            goToCard(currentIndex + 1);
        } else if (diff < -swipeThreshold) {
            // Swiped right - go to previous
            goToCard(currentIndex - 1);
        }
    }

    // Initialize - show first card
    showCard(0);
}

// Add active state to nav links based on scroll position
window.addEventListener('scroll', function () {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        const navbarHeight = document.querySelector('.navbar').offsetHeight;

        if (window.scrollY >= sectionTop - navbarHeight - 100) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});
