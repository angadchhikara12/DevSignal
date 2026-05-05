// DevSignal - Developer Profile Analyzer
// Main application logic

class DevSignal {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.apiBase = 'https://api.github.com';
        this.currentChart = 'pie';
        this.chartData = null;
        this.chartColors = [
            '#8b5cf6', // purple
            '#06b6d4', // cyan
            '#10b981', // green
            '#f59e0b', // amber
            '#ef4444'  // red
        ];
        
        // Initialize routing
        this.initializeRouting();
    }

    initializeElements() {
        // Form elements
        this.form = document.getElementById('analysis-form');
        this.usernameInput = document.getElementById('github-username');
        this.analyzeBtn = document.getElementById('analyze-btn');
        
        // Section elements
        this.inputSection = document.getElementById('input-section');
        this.loadingSection = document.getElementById('loading-section');
        this.resultsSection = document.getElementById('results-section');
        
        // Error element
        this.errorMessage = document.getElementById('error-message');
        
        // Results elements
        this.userAvatar = document.getElementById('user-avatar');
        this.userName = document.getElementById('user-name');
        this.userLogin = document.getElementById('user-login');
        this.hireabilityScore = document.getElementById('hireability-score');
        this.hireabilityLevel = document.getElementById('hireability-level');
        this.developerType = document.getElementById('developer-type');
        this.weaknessesList = document.getElementById('weaknesses-list');
        this.suggestionsList = document.getElementById('suggestions-list');
        
        // Chart elements
        this.chartCanvas = document.getElementById('chart-canvas');
        this.chartLegend = document.getElementById('chart-legend');
        this.chartButtons = document.querySelectorAll('.chart-btn');
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Chart button events
        this.chartButtons.forEach(button => {
            button.addEventListener('click', (e) => this.handleChartTypeChange(e));
        });
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showError('Please enter a GitHub username');
            return;
        }

        this.hideError();
        this.analyzeUser(username);
    }

    async fetchUserData(username) {
        // Fetch user profile
        const userResponse = await this.fetchWithRateLimit(`${this.apiBase}/users/${username}`);
        
        if (!userResponse.ok) {
            if (userResponse.status === 404) {
                throw new Error('User not found. Please check the username and try again.');
            } else if (userResponse.status === 403) {
                throw new Error('GitHub API rate limit exceeded. Please try again in a few minutes.');
            } else {
                throw new Error('Failed to fetch user data. Please try again.');
            }
        }

        const user = await userResponse.json();
        
        // Fetch repositories
        const reposResponse = await this.fetchWithRateLimit(`${this.apiBase}/users/${username}/repos?per_page=100&sort=updated`);
        
        if (!reposResponse.ok) {
            throw new Error('Failed to fetch repository data. Please try again.');
        }

        const repos = await reposResponse.json();
        
        return {
            user,
            repos
        };
    }

    async fetchWithRateLimit(url) {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        // Check for rate limiting
        if (response.status === 403) {
            const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
            const rateLimitReset = response.headers.get('X-RateLimit-Reset');
            
            if (rateLimitRemaining === '0' && rateLimitReset) {
                const resetTime = new Date(parseInt(rateLimitReset) * 1000);
                const waitTime = Math.ceil((resetTime - new Date()) / 1000 / 60);
                throw new Error(`GitHub API rate limit exceeded. Please try again in ${waitTime} minutes.`);
            }
        }
        
        return response;
    }

    analyzeProfile(userData) {
        const { user, repos } = userData;
        
        // Calculate individual scores
        const codeQuality = this.calculateCodeQuality(repos);
        const consistency = this.calculateConsistency(repos);
        const problemSolving = this.calculateProblemSolving(repos);
        const projectDepth = this.calculateProjectDepth(repos);
        const collaboration = this.calculateCollaboration(user, repos);
        
        // Calculate weighted hireability score
        const hireabilityScore = Math.round(
            codeQuality * 0.25 +
            problemSolving * 0.25 +
            projectDepth * 0.20 +
            consistency * 0.15 +
            collaboration * 0.15
        );
        
        // Determine developer type
        const developerType = this.determineDeveloperType({
            codeQuality,
            consistency,
            problemSolving,
            projectDepth,
            collaboration
        });
        
        // Detect weaknesses
        const weaknesses = this.detectWeaknesses({
            codeQuality,
            consistency,
            problemSolving,
            projectDepth,
            collaboration
        });
        
        // Generate suggestions
        const suggestions = this.generateSuggestions(weaknesses);
        
        return {
            codeQuality,
            consistency,
            problemSolving,
            projectDepth,
            collaboration,
            hireabilityScore,
            developerType,
            weaknesses,
            suggestions
        };
    }

    calculateCodeQuality(repos) {
        if (repos.length === 0) return 0;
        
        let score = 0;
        const maxScore = 100;
        
        // Base score for having repositories
        score += Math.min(repos.length * 2, 20); // Max 20 points for repo count
        
        // Stars per repository (average)
        const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const avgStars = totalStars / repos.length;
        score += Math.min(avgStars * 2, 20); // Max 20 points for stars
        
        // README presence
        const reposWithReadme = repos.filter(repo => repo.has_readme).length;
        score += (reposWithReadme / repos.length) * 20; // Max 20 points
        
        // Description presence
        const reposWithDescription = repos.filter(repo => repo.description).length;
        score += (reposWithDescription / repos.length) * 20; // Max 20 points
        
        // Homepage presence
        const reposWithHomepage = repos.filter(repo => repo.homepage).length;
        score += (reposWithHomepage / repos.length) * 20; // Max 20 points
        
        return Math.min(Math.round(score), maxScore);
    }

    calculateConsistency(repos) {
        if (repos.length === 0) return 0;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentRepos = repos.filter(repo => 
            new Date(repo.updated_at) > thirtyDaysAgo
        );
        
        // Score based on recent activity
        const recentActivityRatio = recentRepos.length / repos.length;
        let score = recentActivityRatio * 50; // Max 50 points for recent activity
        
        // Bonus for very recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const veryRecentRepos = repos.filter(repo => 
            new Date(repo.updated_at) > sevenDaysAgo
        );
        
        score += (veryRecentRepos.length / repos.length) * 50; // Max 50 points bonus
        
        return Math.min(Math.round(score), 100);
    }

    calculateProblemSolving(repos) {
        if (repos.length === 0) return 0;
        
        let score = 0;
        
        // Base score for repository count (proxy for coding activity)
        score += Math.min(repos.length * 3, 30); // Max 30 points
        
        // Language diversity (complexity hint)
        const languages = new Set();
        repos.forEach(repo => {
            if (repo.language) {
                languages.add(repo.language);
            }
        });
        score += Math.min(languages.size * 5, 25); // Max 25 points
        
        // Repository complexity hints
        const complexRepos = repos.filter(repo => {
            // Consider repos with multiple topics, good size, or forks as complex
            return (repo.topics && repo.topics.length > 2) || 
                   repo.forks_count > 5 || 
                   repo.size > 1000;
        });
        score += (complexRepos.length / repos.length) * 45; // Max 45 points
        
        return Math.min(Math.round(score), 100);
    }

    calculateProjectDepth(repos) {
        if (repos.length === 0) return 0;
        
        let score = 0;
        
        // Meaningful repositories (not empty or tiny)
        const meaningfulRepos = repos.filter(repo => 
            repo.size > 10 && // Not empty
            repo.name !== '.github' && // Exclude meta repos
            !repo.fork // Original repos only
        );
        
        score += (meaningfulRepos.length / Math.max(repos.length, 1)) * 30; // Max 30 points
        
        // Deployment links (homepage)
        const deployedRepos = repos.filter(repo => repo.homepage);
        score += (deployedRepos.length / repos.length) * 25; // Max 25 points
        
        // Fork activity (community engagement)
        const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
        score += Math.min(totalForks / 10, 25); // Max 25 points
        
        // Repository activity (watchers)
        const totalWatchers = repos.reduce((sum, repo) => sum + repo.watchers_count, 0);
        score += Math.min(totalWatchers / 5, 20); // Max 20 points
        
        return Math.min(Math.round(score), 100);
    }

    calculateCollaboration(user, repos) {
        let score = 0;
        
        // Followers score
        score += Math.min(user.followers * 2, 30); // Max 30 points
        
        // Following score (indicates networking)
        score += Math.min(user.following, 20); // Max 20 points
        
        // Forks received (community engagement)
        const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
        score += Math.min(totalForks / 5, 30); // Max 30 points
        
        // Account age (consistency indicator)
        const accountAge = (new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24 * 365);
        score += Math.min(accountAge * 5, 20); // Max 20 points
        
        return Math.min(Math.round(score), 100);
    }

    determineDeveloperType(scores) {
        const { problemSolving, projectDepth, codeQuality } = scores;
        
        if (problemSolving >= 80 && projectDepth >= 80) {
            return 'Balanced Developer';
        } else if (problemSolving >= 80) {
            return 'Algorithm-focused Developer';
        } else if (projectDepth >= 80) {
            return 'Builder Developer';
        } else if (codeQuality >= 70) {
            return 'Quality-focused Developer';
        } else {
            return 'Growing Developer';
        }
    }

    detectWeaknesses(scores) {
        const weaknesses = [];
        
        if (scores.consistency < 50) {
            weaknesses.push('Inconsistent activity');
        }
        
        if (scores.collaboration < 50) {
            weaknesses.push('Low open-source presence');
        }
        
        if (scores.projectDepth < 50) {
            weaknesses.push('Lack of real-world projects');
        }
        
        if (scores.codeQuality < 50) {
            weaknesses.push('Poor documentation or structure');
        }
        
        if (scores.problemSolving < 50) {
            weaknesses.push('Limited problem-solving visibility');
        }
        
        return weaknesses;
    }

    generateSuggestions(weaknesses) {
        const suggestions = [];
        
        const suggestionMap = {
            'Inconsistent activity': 'Commit regularly (weekly baseline) to show consistent development',
            'Low open-source presence': 'Contribute to open source projects and engage with the community',
            'Lack of real-world projects': 'Build and deploy 2-3 full-stack applications to showcase practical skills',
            'Poor documentation or structure': 'Improve README files and repository organization for better presentation',
            'Limited problem-solving visibility': 'Create coding challenge solutions and algorithmic projects to demonstrate problem-solving skills'
        };
        
        weaknesses.forEach(weakness => {
            if (suggestionMap[weakness]) {
                suggestions.push(suggestionMap[weakness]);
            }
        });
        
        return suggestions;
    }

    getHireabilityLevel(score) {
        if (score >= 85) return 'Strong Candidate';
        if (score >= 70) return 'Job-ready (Junior)';
        if (score >= 40) return 'Developing';
        return 'Early-stage';
    }

    displayResults(userData, analysis) {
        const { user } = userData;
        
        // Update user info
        this.userAvatar.src = user.avatar_url;
        this.userAvatar.alt = `${user.name || user.login}'s avatar`;
        this.userName.textContent = user.name || user.login;
        this.userLogin.textContent = `@${user.login}`;
        
        // Update scores
        this.hireabilityScore.textContent = `${analysis.hireabilityScore}%`;
        this.hireabilityLevel.textContent = this.getHireabilityLevel(analysis.hireabilityScore);
        this.developerType.textContent = analysis.developerType;
        
        // Update score bars
        this.updateScoreBar('code-quality', analysis.codeQuality);
        this.updateScoreBar('consistency', analysis.consistency);
        this.updateScoreBar('problem-solving', analysis.problemSolving);
        this.updateScoreBar('project-depth', analysis.projectDepth);
        this.updateScoreBar('collaboration', analysis.collaboration);
        
        // Update weaknesses
        this.weaknessesList.innerHTML = '';
        analysis.weaknesses.forEach(weakness => {
            const li = document.createElement('li');
            li.textContent = weakness;
            this.weaknessesList.appendChild(li);
        });
        
        // Update suggestions
        this.suggestionsList.innerHTML = '';
        analysis.suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion;
            this.suggestionsList.appendChild(li);
        });
        
        // Prepare chart data and render chart
        this.prepareChartData(analysis);
        this.renderChart();
        
        // Show results
        this.showResults();
    }

    updateScoreBar(scoreId, score) {
        const fillElement = document.getElementById(`${scoreId}-fill`);
        const valueElement = document.getElementById(`${scoreId}-value`);
        
        if (fillElement && valueElement) {
            fillElement.style.width = `${score}%`;
            valueElement.textContent = `${score}%`;
        }
    }

    showLoading() {
        this.inputSection.classList.add('hidden');
        this.loadingSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
    }

    showResults() {
        this.inputSection.classList.remove('hidden');
        this.loadingSection.classList.add('hidden');
        this.resultsSection.classList.remove('hidden');
        
        // Add animation classes
        this.resultsSection.classList.add('fade-in');
        
        // Scroll to results
        setTimeout(() => {
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    resetToInput() {
        this.inputSection.classList.remove('hidden');
        this.loadingSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        
        // Reset form
        this.form.reset();
        this.hideError();
        
        // Clear URL to base path
        window.history.pushState({}, '', '/');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    handleError(error) {
        console.error('Error:', error);
        this.resetToInput();
        this.showError(error.message || 'An unexpected error occurred. Please try again.');
    }

    // URL Routing Methods
    initializeRouting() {
        // Handle browser back/forward navigation
        window.addEventListener('popstate', (e) => {
            this.handleRoute();
        });
        
        // Handle initial page load
        this.handleRoute();
    }

    handleRoute() {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user');
        
        if (username) {
            this.analyzeUserFromURL(username);
        } else {
            // Show default input view
            this.resetToInput();
        }
    }

    analyzeUserFromURL(username) {
        // Set username in input field
        this.usernameInput.value = username;
        
        // Auto-analyze
        this.analyzeUser(username);
    }

    updateURL(username) {
        const newURL = `/?user=${encodeURIComponent(username)}`;
        const state = { username };
        
        // Update browser URL without page reload
        window.history.pushState(state, '', newURL);
    }

    async analyzeUser(username) {
        this.showLoading();
        
        try {
            const userData = await this.fetchUserData(username);
            const analysis = this.analyzeProfile(userData);
            this.displayResults(userData, analysis);
            
            // Update URL if not already set
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('user') !== username) {
                this.updateURL(username);
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    // Chart Visualization Methods
    handleChartTypeChange(e) {
        const button = e.target;
        const chartType = button.dataset.chart;
        
        // Update active button
        this.chartButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update current chart type and re-render
        this.currentChart = chartType;
        this.renderChart();
    }

    prepareChartData(analysis) {
        this.chartData = {
            labels: ['Code Quality', 'Consistency', 'Problem Solving', 'Project Depth', 'Collaboration'],
            values: [
                analysis.codeQuality,
                analysis.consistency,
                analysis.problemSolving,
                analysis.projectDepth,
                analysis.collaboration
            ],
            icons: ['🧱', '🚀', '🧠', '🏗️', '🤝']
        };
    }

    renderChart() {
        if (!this.chartData) return;
        
        // Clear canvas
        const ctx = this.chartCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.chartCanvas.width, this.chartCanvas.height);
        
        // Render based on current chart type
        switch (this.currentChart) {
            case 'pie':
                this.renderPieChart(ctx);
                break;
            case 'bar':
                this.renderBarChart(ctx);
                break;
            case 'line':
                this.renderLineChart(ctx);
                break;
            case 'radar':
                this.renderRadarChart(ctx);
                break;
        }
        
        // Update legend
        this.updateLegend();
    }

    renderPieChart(ctx) {
        // Set much larger canvas dimensions
        this.chartCanvas.width = 800;
        this.chartCanvas.height = 800;
        
        const centerX = this.chartCanvas.width / 2;
        const centerY = this.chartCanvas.height / 2;
        const radius = Math.min(centerX, centerY) - 30; // Much larger radius
        
        let currentAngle = -Math.PI / 2;
        const total = this.chartData.values.reduce((sum, val) => sum + val, 0);
        
        this.chartData.values.forEach((value, index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            
            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY); // Start from center
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = this.chartColors[index];
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = '#1f1f1f';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw percentage text with larger font
            const textAngle = currentAngle + sliceAngle / 2;
            const textX = centerX + Math.cos(textAngle) * (radius * 0.7);
            const textY = centerY + Math.sin(textAngle) * (radius * 0.7);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round((value / total) * 100)}%`, textX, textY);
            
            currentAngle += sliceAngle;
        });
    }

    renderBarChart(ctx) {
        // Clear canvas and set proper dimensions first
        this.chartCanvas.width = 800;
        this.chartCanvas.height = 600; // Increased height for full 0-100% range
        
        const padding = 100; // Increased padding for more text space
        const chartWidth = this.chartCanvas.width - padding * 2;
        const chartHeight = this.chartCanvas.height - padding * 2;
        const barWidth = chartWidth / this.chartData.labels.length * 0.5; // Narrower bars
        const barSpacing = chartWidth / this.chartData.labels.length;
        
        // Draw axes
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, this.chartCanvas.height - padding);
        ctx.lineTo(this.chartCanvas.width - padding, this.chartCanvas.height - padding);
        ctx.stroke();
        
        // Draw bars
        this.chartData.values.forEach((value, index) => {
            const barHeight = (value / 100) * chartHeight;
            const x = padding + index * barSpacing + (barSpacing - barWidth) / 2;
            const y = this.chartCanvas.height - padding - barHeight;
            
            // Draw bar
            ctx.fillStyle = this.chartColors[index];
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw value on top with larger font
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${value}%`, x + barWidth / 2, y - 10);
            
            // Draw label below axis with better positioning
            ctx.save();
            ctx.translate(x + barWidth / 2, this.chartCanvas.height - padding + 40);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = '#a0a0a0';
            ctx.font = '12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(this.chartData.labels[index], 0, 0);
            ctx.restore();
        });
        
        // Draw axis labels for better readability
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Y-axis labels - every 20% (0%, 20%, 40%, 60%, 80%, 100%)
        for (let i = 0; i <= 100; i += 20) {
            const y = this.chartCanvas.height - padding - (i / 100) * chartHeight;
            ctx.fillText(`${i}%`, padding - 20, y + 4);
        }
    }

    renderLineChart(ctx) {
        // Clear canvas and set proper dimensions first
        this.chartCanvas.width = 800;
        this.chartCanvas.height = 600;
        
        const padding = 80;
        const chartWidth = this.chartCanvas.width - padding * 2;
        const chartHeight = this.chartCanvas.height - padding * 2;
        const pointSpacing = chartWidth / (this.chartData.labels.length - 1);
        
        // Draw axes
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, this.chartCanvas.height - padding);
        ctx.lineTo(this.chartCanvas.width - padding, this.chartCanvas.height - padding);
        ctx.stroke();
        
        // Draw line
        ctx.strokeStyle = this.chartColors[0];
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        this.chartData.values.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = this.chartCanvas.height - padding - (value / 100) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points and labels
        this.chartData.values.forEach((value, index) => {
            const x = padding + index * pointSpacing;
            const y = this.chartCanvas.height - padding - (value / 100) * chartHeight;
            
            // Draw point
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = this.chartColors[index];
            ctx.fill();
            ctx.strokeStyle = '#1f1f1f';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw value
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${value}%`, x, y - 10);
            
            // Draw label
            ctx.fillStyle = '#a0a0a0';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.chartData.labels[index], x, this.chartCanvas.height - padding + 20);
        });
        
        // Draw Y-axis labels - every 20% (0%, 20%, 40%, 60%, 80%, 100%)
        ctx.fillStyle = '#a0a0a0';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        for (let i = 0; i <= 100; i += 20) {
            const y = this.chartCanvas.height - padding - (i / 100) * chartHeight;
            ctx.fillText(`${i}%`, padding - 20, y + 4);
        }
    }

    renderRadarChart(ctx) {
        const centerX = this.chartCanvas.width / 2;
        const centerY = this.chartCanvas.height / 2;
        const radius = Math.min(centerX, centerY) - 60;
        const angleStep = (2 * Math.PI) / this.chartData.labels.length;
        
        // Draw grid
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            for (let j = 0; j < this.chartData.labels.length; j++) {
                const angle = j * angleStep - Math.PI / 2;
                const x = centerX + Math.cos(angle) * (radius * i / 5);
                const y = centerY + Math.sin(angle) * (radius * i / 5);
                
                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw axes
        for (let i = 0; i < this.chartData.labels.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.stroke();
        }
        
        // Draw data polygon
        ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.chartData.values.forEach((value, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const distance = (value / 100) * radius;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw points and labels
        this.chartData.values.forEach((value, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const distance = (value / 100) * radius;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Draw point
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#8b5cf6';
            ctx.fill();
            
            // Draw label
            const labelX = centerX + Math.cos(angle) * (radius + 30);
            const labelY = centerY + Math.sin(angle) * (radius + 30);
            
            ctx.fillStyle = '#a0a0a0';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.chartData.labels[index], labelX, labelY);
        });
    }

    updateLegend() {
        this.chartLegend.innerHTML = '';
        
        this.chartData.labels.forEach((label, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${this.chartColors[index]}"></div>
                <span class="legend-label">${label}</span>
                <span class="legend-value">${this.chartData.values[index]}%</span>
            `;
            
            this.chartLegend.appendChild(legendItem);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DevSignal();
});

// Add some utility functions
const utils = {
    // Format date to readable string
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    // Format number with commas
    formatNumber(num) {
        return num.toLocaleString();
    },
    
    // Calculate days between two dates
    daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((new Date(date1) - new Date(date2)) / oneDay));
    }
};
