// API基础URL - 使用相对路径，避免 localhost 和 127.0.0.1 跨域问题
const API_BASE = '/api';

// 全局状态
let currentCategory = '';
let showIncompleteOnly = false; // 数据状态筛选: 是否只显示数据缺失的画师
let searchKeyword = ''; // 搜索关键词
let allArtists = [];
let allCategories = [];
let currentLayout = 'grid'; // 'grid' or 'list'
let currentArtistDetail = null; // 当前查看详情的画师
let selectedCategoryIds = []; // 当前选择的分类ID列表（用于添加/编辑画师）

// ================== 登出功能 ==================

document.getElementById('logout-btn').addEventListener('click', async () => {
    if (!confirm('确定要登出吗?')) return;

    try {
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',  // 重要：携带cookie
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            // 登出成功，跳转到登录页
            window.location.href = '/login';
        } else {
            showMessage('登出失败', 'error');
        }
    } catch (error) {
        console.error('登出失败:', error);
        showMessage('登出失败: ' + error.message, 'error');
    }
});

// ================== 工具函数 ==================

// Toast通知系统
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500',
        loading: 'bg-purple-500'
    };

    const icons = {
        success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        loading: '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
    };

    toast.className = `${bgColors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`;
    toast.innerHTML = `
        ${icons[type]}
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="hover:bg-white hover:bg-opacity-20 rounded p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);

    // 自动消失（loading类型不自动消失）
    if (duration > 0 && type !== 'loading') {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // 返回toast元素引用，以便手动关闭
    return toast;
}

// 关闭指定的toast
function closeToast(toast) {
    if (toast && toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }
}

// 更新toast的消息和类型
function updateToast(toast, message, type = 'info') {
    if (!toast || !toast.parentElement) return;

    const bgColors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500',
        loading: 'bg-purple-500'
    };

    const icons = {
        success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        loading: '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
    };

    // 更新背景颜色
    toast.className = `${bgColors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`;

    // 更新内容
    toast.innerHTML = `
        ${icons[type]}
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="hover:bg-white hover:bg-opacity-20 rounded p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
        </button>
    `;

    // 如果改为非loading类型，设置自动消失
    if (type !== 'loading') {
        setTimeout(() => {
            closeToast(toast);
        }, 3000);
    }
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-overlay').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('flex');
}

function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    document.getElementById(modalId).classList.add('flex');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    document.getElementById(modalId).classList.remove('flex');
}

function showMessage(message, type = 'info') {
    showToast(message, type);
}

// 进度条控制
function showProgress(text = '处理中...', detail = '准备开始...') {
    const container = document.getElementById('progress-container');
    container.classList.remove('hidden');
    document.getElementById('progress-text').textContent = text;
    document.getElementById('progress-detail').textContent = detail;
    updateProgress(0);
}

function updateProgress(percent, detail = '') {
    const bar = document.getElementById('progress-bar');
    const percentText = document.getElementById('progress-percent');
    const detailText = document.getElementById('progress-detail');

    bar.style.width = `${percent}%`;
    percentText.textContent = `${Math.round(percent)}%`;
    if (detail) {
        detailText.textContent = detail;
    }
}

function hideProgress() {
    document.getElementById('progress-container').classList.add('hidden');
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            credentials: 'include',  // 重要：携带cookie
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        const data = await response.json();

        // 如果返回401未登录，跳转到登录页
        if (response.status === 401) {
            window.location.href = '/login';
            throw new Error('未登录，请先登录');
        }

        if (!data.success) {
            throw new Error(data.error || '请求失败');
        }
        return data;
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

// 去除artist:前缀
function removeArtistPrefix(name) {
    if (!name) return '';
    return name.startsWith('artist:') ? name.substring(7) : name;
}

// ================== 标签页切换 ==================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        // 切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.dataset.active = 'false';
        });
        btn.dataset.active = 'true';

        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');

        // 加载对应数据
        if (tabName === 'artists') loadArtists();
        else if (tabName === 'categories') loadCategories();
        else if (tabName === 'presets') loadPresets();
    });
});

// ================== 布局切换 ==================

document.getElementById('layout-grid').addEventListener('click', () => {
    currentLayout = 'grid';
    document.getElementById('layout-grid').classList.add('border-primary', 'bg-primary', 'text-white');
    document.getElementById('layout-grid').classList.remove('border-gray-300', 'text-gray-600');
    document.getElementById('layout-list').classList.remove('border-primary', 'bg-primary', 'text-white');
    document.getElementById('layout-list').classList.add('border-gray-300', 'text-gray-600');
    const filtered = getFilteredArtists();
    renderArtists(filtered);
});

document.getElementById('layout-list').addEventListener('click', () => {
    currentLayout = 'list';
    document.getElementById('layout-list').classList.add('border-primary', 'bg-primary', 'text-white');
    document.getElementById('layout-list').classList.remove('border-gray-300', 'text-gray-600');
    document.getElementById('layout-grid').classList.remove('border-primary', 'bg-primary', 'text-white');
    document.getElementById('layout-grid').classList.add('border-gray-300', 'text-gray-600');
    const filtered = getFilteredArtists();
    renderArtists(filtered);
});

// ================== 画师管理 ==================

// 检查画师是否存在数据缺失
function hasIncompleteData(artist) {
    // 检查所有字段，无论是否跳过Danbooru检测
    // "跳过Danbooru检测"仅影响自动补全行为，不影响"待补全"状态显示
    return !artist.name_noob || !artist.name_nai ||
           !artist.danbooru_link || !artist.post_count ||
           !artist.image_example;
}

// 应用所有筛选条件
function getFilteredArtists() {
    let filtered = allArtists;

    // 应用分类筛选
    if (currentCategory) {
        filtered = filtered.filter(a => a.category_id == currentCategory);
    }

    // 应用数据状态筛选
    if (showIncompleteOnly) {
        filtered = filtered.filter(a => hasIncompleteData(a));
    }

    // 应用搜索筛选
    if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase().trim();
        filtered = filtered.filter(artist => {
            const nameNoob = (artist.name_noob || '').toLowerCase();
            const nameNai = (artist.name_nai || '').toLowerCase();
            // 匹配NOOB格式或NAI格式（去掉artist:前缀后的名称）
            const nameNaiWithoutPrefix = nameNai.replace(/^artist:\s*/i, '');
            return nameNoob.includes(keyword) ||
                   nameNai.includes(keyword) ||
                   nameNaiWithoutPrefix.includes(keyword);
        });
    }

    return filtered;
}

async function loadArtists() {
    showLoading();
    try {
        const categoryId = document.getElementById('filter-category').value;
        const endpoint = categoryId ? `/artists?category_id=${categoryId}` : '/artists';
        const result = await fetchAPI(endpoint);
        allArtists = result.data;

        // 应用筛选并渲染
        const filtered = getFilteredArtists();
        renderArtists(filtered);
    } catch (error) {
        showMessage('加载画师失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 渲染分类标签（支持多个分类，限制显示数量）
function renderCategoryTags(categories, maxDisplay = 2) {
    if (!categories || categories.length === 0) {
        return '<span class="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">未分类</span>';
    }

    const displayCategories = categories.slice(0, maxDisplay);
    const remainingCount = categories.length - maxDisplay;

    let tagsHtml = displayCategories.map(cat =>
        `<span class="text-xs bg-primary text-white px-2 py-0.5 rounded-full">${cat.name}</span>`
    ).join('');

    if (remainingCount > 0) {
        tagsHtml += `<span class="text-xs bg-purple-400 text-white px-2 py-0.5 rounded-full">+${remainingCount}</span>`;
    }

    return tagsHtml;
}

function renderArtists(artists) {
    const container = document.getElementById('artist-list');

    if (artists.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 col-span-full py-8">暂无数据</p>';
        return;
    }

    // 切换布局容器类
    if (currentLayout === 'grid') {
        container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
    } else {
        container.className = 'space-y-3';
    }

    container.innerHTML = artists.map(artist => {
        const displayName = removeArtistPrefix(artist.name_nai) || artist.name_noob || '未命名';
        const imageUrl = artist.image_example ? `/images/${artist.image_example}` : null;

        // 检查缺失的数据
        const missingData = [];
        if (!artist.name_noob || !artist.name_nai) missingData.push('名称');
        if (!artist.danbooru_link) missingData.push('链接');
        if (!artist.post_count) missingData.push('作品数');
        if (!artist.image_example) missingData.push('图片');

        // 边框颜色：数据不完整显示黄色，完整显示灰色
        const borderColor = missingData.length > 0 ? 'border-yellow-300' : 'border-gray-200';
        const borderTitle = missingData.length > 0 ? `数据不完整 - 缺失: ${missingData.join(', ')}` : '数据完整';

        if (currentLayout === 'grid') {
            // 网格布局 - 紧凑卡片
            return `
                <div class="bg-white border-2 ${borderColor} rounded-lg p-3 cursor-pointer hover:border-primary hover:shadow-lg transition" onclick="showArtistDetail(${artist.id})" title="${borderTitle}">
                    ${imageUrl ? `
                        <img src="${imageUrl}" class="w-full h-32 object-cover rounded-md mb-2" alt="${displayName}">
                    ` : `
                        <div class="w-full h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-md mb-2 flex items-center justify-center text-gray-400">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                        </div>
                    `}
                    <div class="space-y-1">
                        <div class="flex items-center justify-between gap-1 flex-wrap">
                            <div class="flex items-center gap-1 flex-wrap">
                                ${renderCategoryTags(artist.categories, 2)}
                            </div>
                            ${artist.post_count ? `<span class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">${artist.post_count}</span>` : ''}
                        </div>
                        <h3 class="font-semibold text-gray-800 truncate" title="${displayName}">${displayName}</h3>
                    </div>
                </div>
            `;
        } else {
            // 列表布局 - 单行显示
            return `
                <div class="bg-white border-2 ${borderColor} rounded-lg p-3 cursor-pointer hover:border-primary hover:shadow-md transition flex items-center gap-4" onclick="showArtistDetail(${artist.id})" title="${borderTitle}">
                    ${imageUrl ? `
                        <img src="${imageUrl}" class="artist-thumbnail rounded-md flex-shrink-0" alt="${displayName}">
                    ` : `
                        <div class="artist-thumbnail bg-gradient-to-br from-purple-100 to-blue-100 rounded-md flex-shrink-0 flex items-center justify-center text-gray-400">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                        </div>
                    `}
                    <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-gray-800 truncate">${displayName}</h3>
                        <div class="flex items-center gap-1 mt-1 flex-wrap">
                            ${renderCategoryTags(artist.categories, 3)}
                            ${artist.post_count ? `<span class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full ml-1">${artist.post_count} 作品</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// 显示画师详情
window.showArtistDetail = async function(artistId) {
    try {
        const result = await fetchAPI(`/artists/${artistId}`);
        currentArtistDetail = result.data;
        const artist = result.data;

        const displayName = removeArtistPrefix(artist.name_nai) || artist.name_noob || '未命名';
        document.getElementById('detail-artist-name').textContent = displayName;

        const content = document.getElementById('artist-detail-content');
        const imageUrl = artist.image_example ? `/images/${artist.image_example}` : null;

        content.innerHTML = `
            <div class="space-y-6">
                ${imageUrl ? `
                    <div>
                        <img src="${imageUrl}" class="w-full max-h-64 object-contain rounded-lg border border-gray-200" alt="${displayName}">
                    </div>
                ` : ''}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm font-semibold text-gray-600">分类</label>
                        <div class="flex items-center gap-1 mt-1 flex-wrap">
                            ${renderCategoryTags(artist.categories, 5)}
                        </div>
                    </div>
                    <div>
                        <label class="text-sm font-semibold text-gray-600">作品数量</label>
                        <p class="text-gray-800 mt-1">${artist.post_count || '未获取'}</p>
                    </div>
                    <div>
                        <label class="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            NOOB格式
                            ${artist.name_noob ? `
                                <button onclick="copyToClipboard('${artist.name_noob.replace(/'/g, "\\'")}', 'NOOB')" class="text-primary hover:text-purple-700 transition" title="复制">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </label>
                        <p class="text-gray-800 mt-1 font-mono text-sm break-all">${artist.name_noob || '-'}</p>
                    </div>
                    <div>
                        <label class="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            NAI格式
                            ${artist.name_nai ? `
                                <button onclick="copyToClipboard('${artist.name_nai.replace(/'/g, "\\'")}', 'NAI')" class="text-primary hover:text-purple-700 transition" title="复制">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </label>
                        <p class="text-gray-800 mt-1 font-mono text-sm break-all">${artist.name_nai || '-'}</p>
                    </div>
                </div>

                ${artist.danbooru_link ? `
                    <div>
                        <label class="text-sm font-semibold text-gray-600">Danbooru链接</label>
                        <p class="mt-1"><a href="${artist.danbooru_link}" target="_blank" class="text-primary hover:underline break-all">${artist.danbooru_link}</a></p>
                    </div>
                ` : ''}

                ${artist.notes ? `
                    <div>
                        <label class="text-sm font-semibold text-gray-600">备注</label>
                        <p class="text-gray-800 mt-1 whitespace-pre-wrap">${artist.notes}</p>
                    </div>
                ` : ''}
            </div>
        `;

        showModal('artist-detail-modal');
    } catch (error) {
        showMessage('加载画师详情失败: ' + error.message, 'error');
    }
}

// 详情模态框的编辑按钮
document.getElementById('detail-edit-btn').addEventListener('click', () => {
    if (currentArtistDetail) {
        hideModal('artist-detail-modal');
        editArtist(currentArtistDetail.id);
    }
});

// 详情模态框的删除按钮
document.getElementById('detail-delete-btn').addEventListener('click', () => {
    if (currentArtistDetail) {
        hideModal('artist-detail-modal');
        deleteArtist(currentArtistDetail.id);
    }
});

async function editArtist(artistId) {
    try {
        const result = await fetchAPI(`/artists/${artistId}`);
        const artist = result.data;

        document.getElementById('artist-id').value = artist.id;

        // 设置已选择的分类
        selectedCategoryIds = [];
        if (artist.categories && artist.categories.length > 0) {
            selectedCategoryIds = artist.categories.map(c => c.id);
        } else if (artist.category_id) {
            // 兼容旧格式
            selectedCategoryIds = [artist.category_id];
        }
        renderSelectedCategories();

        document.getElementById('artist-noob').value = artist.name_noob || '';
        document.getElementById('artist-nai').value = artist.name_nai || '';
        document.getElementById('artist-link').value = artist.danbooru_link || '';
        document.getElementById('artist-count').value = artist.post_count || '';
        document.getElementById('artist-notes').value = artist.notes || '';
        document.getElementById('artist-skip-danbooru').checked = artist.skip_danbooru || false;

        // 显示当前图片预览
        const previewContainer = document.getElementById('current-image-preview');
        const previewImg = document.getElementById('preview-img');
        if (artist.image_example) {
            previewImg.src = `/images/${artist.image_example}`;
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }

        // 清空文件输入
        document.getElementById('artist-image-upload').value = '';

        document.getElementById('artist-modal-title').textContent = '编辑画师';
        showModal('artist-modal');
    } catch (error) {
        showMessage('加载画师信息失败: ' + error.message, 'error');
    }
}

async function deleteArtist(artistId) {
    if (!confirm('确定要删除这个画师吗?')) return;

    showLoading();
    try {
        await fetchAPI(`/artists/${artistId}`, { method: 'DELETE' });
        showMessage('删除成功', 'success');
        loadArtists();
    } catch (error) {
        showMessage('删除失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ================== 分类管理 ==================

async function loadCategories() {
    showLoading();
    try {
        const result = await fetchAPI('/categories');
        allCategories = result.data;
        renderCategories(result.data);
        updateCategorySelects();
    } catch (error) {
        showMessage('加载分类失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderCategories(categories) {
    const container = document.getElementById('category-list');
    if (categories.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">暂无分类</p>';
        return;
    }

    container.innerHTML = `
        <div class="flex flex-wrap gap-3">
            ${categories.map(cat => `
                <div
                    class="inline-flex items-center bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full px-4 py-2 shadow-md hover:shadow-lg transition group cursor-pointer"
                    onclick="editCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', ${cat.display_order})"
                    title="点击编辑分类"
                >
                    <span class="font-medium text-sm">${cat.name}</span>
                    <span class="ml-2 bg-white/20 rounded-full px-2 py-0.5 text-xs font-semibold">${cat.artist_count || 0}</span>
                    <button
                        class="ml-3 w-5 h-5 flex items-center justify-center rounded-full bg-white/0 hover:bg-white/20 transition text-white opacity-70 hover:opacity-100"
                        onclick="event.stopPropagation(); deleteCategory(${cat.id})"
                        title="删除分类"
                    >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function updateCategorySelects() {
    const filterSelect = document.getElementById('filter-category');
    const artistCategorySelect = document.getElementById('artist-category-select');

    // 筛选框：所有分类
    filterSelect.innerHTML = '<option value="">所有分类</option>' +
        allCategories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

    // 添加/编辑画师框：请选择 + 未分类在最前 + 其他分类
    const uncategorized = allCategories.find(c => c.name === '未分类');
    const otherCategories = allCategories.filter(c => c.name !== '未分类');

    let optionsHtml = '<option value="" disabled selected>请选择画师分类</option>';

    if (uncategorized) {
        optionsHtml += `<option value="${uncategorized.id}">未分类</option>`;
    }

    optionsHtml += otherCategories.map(cat =>
        `<option value="${cat.id}">${cat.name}</option>`
    ).join('');

    artistCategorySelect.innerHTML = optionsHtml;
}

// ================== 分类标签管理 ==================

function renderSelectedCategories() {
    // 渲染已选择的分类标签
    const container = document.getElementById('selected-categories');

    if (selectedCategoryIds.length === 0) {
        // 没有选择分类，显示提示
        container.innerHTML = '<span class="text-gray-400 text-sm" id="no-category-hint">尚未选择分类</span>';
        return;
    }

    // 渲染标签
    const tagsHtml = selectedCategoryIds.map(catId => {
        const category = allCategories.find(c => c.id === catId);
        if (!category) return '';

        return `
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-full text-sm">
                ${category.name}
                <button onclick="removeCategory(${catId})" class="hover:bg-white hover:bg-opacity-20 rounded-full p-0.5" title="移除">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </span>
        `;
    }).join('');

    container.innerHTML = tagsHtml;
}

function addCategory(categoryId) {
    // 添加一个分类
    if (!selectedCategoryIds.includes(categoryId)) {
        selectedCategoryIds.push(categoryId);
        renderSelectedCategories();

        // 重置下拉框
        document.getElementById('artist-category-select').value = '';
    }
}

function removeCategory(categoryId) {
    // 移除一个分类
    selectedCategoryIds = selectedCategoryIds.filter(id => id !== categoryId);
    renderSelectedCategories();
}

function clearSelectedCategories() {
    // 清空已选择的分类
    selectedCategoryIds = [];
    renderSelectedCategories();
}

// 暴露到全局
window.removeCategory = removeCategory;

async function editCategory(categoryId, currentName, currentOrder) {
    const newName = prompt('请输入新的分类名称:', currentName);

    if (!newName || !newName.trim()) {
        return; // 用户取消或输入为空
    }

    if (newName.trim() === currentName) {
        // 名称没有改变，询问是否修改显示顺序
        const newOrder = prompt('请输入新的显示顺序:', currentOrder);
        if (newOrder === null) return; // 用户取消

        const orderValue = parseInt(newOrder) || 0;
        if (orderValue === currentOrder) {
            showMessage('没有任何修改', 'info');
            return;
        }

        // 只更新显示顺序
        await updateCategoryAPI(categoryId, currentName, orderValue);
    } else {
        // 名称改变了，询问是否也修改显示顺序
        const newOrder = prompt('请输入新的显示顺序:', currentOrder);
        const orderValue = newOrder !== null ? (parseInt(newOrder) || 0) : currentOrder;

        await updateCategoryAPI(categoryId, newName.trim(), orderValue);
    }
}

async function updateCategoryAPI(categoryId, name, displayOrder) {
    showLoading();
    try {
        await fetchAPI(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: name,
                display_order: displayOrder
            })
        });
        showMessage('更新成功', 'success');
        loadCategories();
        loadArtists();
    } catch (error) {
        showMessage('更新失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('确定要删除这个分类吗?\n该分类下的画师不会被删除，只会移除分类关联，变为"未分类"状态。')) return;

    showLoading();
    try {
        await fetchAPI(`/categories/${categoryId}`, { method: 'DELETE' });
        showMessage('删除成功', 'success');
        loadCategories();
    } catch (error) {
        showMessage('删除失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 暴露给全局
window.deleteCategory = deleteCategory;
window.editCategory = editCategory;

// ================== 画师串管理 ==================

async function loadPresets() {
    showLoading();
    try {
        const result = await fetchAPI('/presets');
        renderPresets(result.data);
    } catch (error) {
        showMessage('加载画师串失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderPresets(presets) {
    const container = document.getElementById('preset-list');
    if (presets.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">暂无画师串</p>';
        return;
    }

    container.innerHTML = presets.map(preset => {
        const artistIds = JSON.parse(preset.artist_ids);
        const artistNames = artistIds.map(id => {
            const artist = allArtists.find(a => a.id === id);
            return artist ? (removeArtistPrefix(artist.name_nai) || artist.name_noob || 'Unknown') : 'Unknown';
        }).join(', ');

        return `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-semibold text-lg text-gray-800">${preset.name}</span>
                    <button class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition" onclick="deletePreset(${preset.id})">删除</button>
                </div>
                ${preset.description ? `<p class="text-gray-600 text-sm mb-3">${preset.description}</p>` : ''}
                <div class="bg-gray-50 p-3 rounded-lg font-mono text-sm">${artistNames}</div>
            </div>
        `;
    }).join('');
}

async function deletePreset(presetId) {
    if (!confirm('确定要删除这个画师串吗?')) return;

    showLoading();
    try {
        await fetchAPI(`/presets/${presetId}`, { method: 'DELETE' });
        showMessage('删除成功', 'success');
        loadPresets();
    } catch (error) {
        showMessage('删除失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 暴露给全局
window.deletePreset = deletePreset;

// ================== 事件监听 ==================

// 分类筛选
document.getElementById('filter-category').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    const filtered = getFilteredArtists();
    renderArtists(filtered);
});

// 数据状态筛选（勾选框）
document.getElementById('filter-data-status').addEventListener('change', (e) => {
    showIncompleteOnly = e.target.checked;
    const filtered = getFilteredArtists();
    renderArtists(filtered);

    // 显示筛选结果提示
    if (showIncompleteOnly) {
        showToast(`已筛选待补全的画师 - 找到 ${filtered.length} 个`, 'info', 2000);
    } else {
        showToast(`显示所有画师 - 共 ${filtered.length} 个`, 'info', 2000);
    }
});

// 搜索框输入
document.getElementById('search-input').addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    const filtered = getFilteredArtists();
    renderArtists(filtered);

    // 显示/隐藏清除按钮
    const clearBtn = document.getElementById('clear-search');
    if (searchKeyword) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }

    // 显示搜索结果提示
    if (searchKeyword) {
        showToast(`搜索 "${searchKeyword}" - 找到 ${filtered.length} 个画师`, 'info', 2000);
    }
});

// 清除搜索按钮
document.getElementById('clear-search').addEventListener('click', () => {
    searchKeyword = '';
    document.getElementById('search-input').value = '';
    document.getElementById('clear-search').classList.add('hidden');
    const filtered = getFilteredArtists();
    renderArtists(filtered);
    showToast('已清除搜索', 'info', 1500);
});

// 添加画师
document.getElementById('add-artist-btn').addEventListener('click', () => {
    document.getElementById('artist-id').value = '';
    clearSelectedCategories();
    document.getElementById('artist-noob').value = '';
    document.getElementById('artist-nai').value = '';
    document.getElementById('artist-link').value = '';
    document.getElementById('artist-count').value = '';
    document.getElementById('artist-notes').value = '';
    document.getElementById('artist-image-upload').value = '';
    document.getElementById('artist-skip-danbooru').checked = false;
    document.getElementById('current-image-preview').classList.add('hidden');
    document.getElementById('artist-modal-title').textContent = '添加画师';
    showModal('artist-modal');
});

// 分类选择下拉框改变事件
document.getElementById('artist-category-select').addEventListener('change', (e) => {
    const categoryId = parseInt(e.target.value);
    if (categoryId) {
        addCategory(categoryId);
    }
});

// 保存画师
document.getElementById('save-artist-btn').addEventListener('click', async () => {
    const artistId = document.getElementById('artist-id').value;

    // 验证：至少选择一个分类
    if (selectedCategoryIds.length === 0) {
        showMessage('请至少选择一个分类', 'error');
        return;
    }

    // 验证：至少填写一个名称
    const nameNoob = document.getElementById('artist-noob').value.trim();
    const nameNai = document.getElementById('artist-nai').value.trim();

    if (!nameNoob && !nameNai) {
        showMessage('画师名称（NOOB或NAI格式）至少需要填写一个', 'error');
        return;
    }

    const data = {
        category_ids: selectedCategoryIds,
        name_noob: nameNoob,
        name_nai: nameNai,
        danbooru_link: document.getElementById('artist-link').value.trim(),
        notes: document.getElementById('artist-notes').value.trim(),
        skip_danbooru: document.getElementById('artist-skip-danbooru').checked,
        auto_complete: true
    };

    const postCount = document.getElementById('artist-count').value;
    if (postCount) data.post_count = parseInt(postCount);

    showLoading();
    try {
        let savedArtistId = artistId;

        // 先保存画师基本信息
        if (artistId) {
            await fetchAPI(`/artists/${artistId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            const result = await fetchAPI('/artists', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            savedArtistId = result.data.id;
        }

        // 如果有上传图片，则上传图片
        const fileInput = document.getElementById('artist-image-upload');
        if (fileInput.files && fileInput.files[0]) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await fetch(`${API_BASE}/artists/${savedArtistId}/upload-image`, {
                method: 'POST',
                credentials: 'include',  // 重要：携带cookie
                body: formData
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || '图片上传失败');
            }
            showToast('图片上传成功', 'success', 2000);
        }

        showMessage('保存成功', 'success');
        hideModal('artist-modal');
        loadArtists();
    } catch (error) {
        showMessage('保存失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 模态框内自动补全
document.getElementById('auto-complete-modal-btn').addEventListener('click', async () => {
    const artistId = document.getElementById('artist-id').value;
    const data = {
        name_noob: document.getElementById('artist-noob').value.trim(),
        name_nai: document.getElementById('artist-nai').value.trim(),
        danbooru_link: document.getElementById('artist-link').value.trim()
    };

    let progressToast = null;

    try {
        // 第一步：补全名称和链接
        progressToast = showToast('正在补全名称和链接...', 'loading');
        const result = await fetchAPI('/tools/auto-complete', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        document.getElementById('artist-noob').value = result.data.name_noob;
        document.getElementById('artist-nai').value = result.data.name_nai;
        document.getElementById('artist-link').value = result.data.danbooru_link;

        // 检查是否跳过Danbooru检测
        const skipDanbooru = document.getElementById('artist-skip-danbooru').checked;

        // 第二步：获取作品数量和示例图片（如果未勾选"跳过Danbooru检测"）
        if (result.data.danbooru_link && !skipDanbooru) {
            updateToast(progressToast, '正在获取作品数量和示例图片（可能需要较长时间）...', 'loading');

            let targetArtistId = artistId;

            // 如果是添加模式（没有artistId），需要先临时创建画师记录
            if (!artistId) {
                // 验证已选择分类
                if (selectedCategoryIds.length === 0) {
                    closeToast(progressToast);
                    showToast('请先选择分类', 'warning');
                    return;
                }

                const tempData = {
                    category_ids: selectedCategoryIds,
                    name_noob: result.data.name_noob,
                    name_nai: result.data.name_nai,
                    danbooru_link: result.data.danbooru_link,
                    notes: document.getElementById('artist-notes').value.trim()
                };

                const createResult = await fetchAPI('/artists', {
                    method: 'POST',
                    body: JSON.stringify(tempData)
                });

                targetArtistId = createResult.data.id;
                // 将新创建的ID设置到隐藏字段，后续保存时会更新而不是重复创建
                document.getElementById('artist-id').value = targetArtistId;
                document.getElementById('artist-modal-title').textContent = '编辑画师';
            }

            // 使用 artistId 获取作品数量和示例图片
            const postCountResult = await fetchAPI('/tools/fetch-post-counts', {
                method: 'POST',
                body: JSON.stringify({ artist_ids: [parseInt(targetArtistId)] })
            });

            if (postCountResult.success && postCountResult.data) {
                // API返回的数据中，artist_id可能是字符串或数字
                const artistData = postCountResult.data[targetArtistId] || postCountResult.data[parseInt(targetArtistId)];

                if (artistData) {
                    // 更新作品数量
                    if (artistData.post_count !== undefined) {
                        document.getElementById('artist-count').value = artistData.post_count;
                    }

                    // 如果有示例图片，重新加载画师信息以显示图片预览
                    if (artistData.example_image) {
                        const updatedArtist = await fetchAPI(`/artists/${targetArtistId}`);
                        if (updatedArtist.success && updatedArtist.data.image_example) {
                            // 显示图片预览
                            const preview = document.getElementById('current-image-preview');
                            const previewImg = document.getElementById('preview-img');
                            previewImg.src = `/images/${updatedArtist.data.image_example}`;
                            preview.classList.remove('hidden');
                        }
                    }
                }

                // 显示详细的结果信息
                if (postCountResult.details) {
                    const details = postCountResult.details;

                    // 检查是否有警告或失败
                    if (details.warnings && details.warnings.length > 0) {
                        // 有警告（比如图片下载失败）
                        updateToast(progressToast, postCountResult.message || '部分信息获取失败', 'warning');
                        console.warn('警告详情:', details.warnings);
                    } else if (details.failed && details.failed.length > 0) {
                        // 完全失败
                        updateToast(progressToast, '无法获取画师数据: ' + details.failed.join(', '), 'error');
                        return;
                    } else if (details.success > 0) {
                        // 完全成功
                        updateToast(progressToast, '自动补全成功', 'success');
                        return;
                    }
                } else {
                    // 没有详细信息，使用默认消息
                    updateToast(progressToast, postCountResult.message || '数据获取完成', 'success');
                    return;
                }
            } else {
                // API调用失败
                updateToast(progressToast, '获取作品数量和图片失败', 'error');
                return;
            }
        } else {
            // 没有链接或勾选了跳过Danbooru检测
            if (skipDanbooru) {
                updateToast(progressToast, '名称补全成功（已跳过Danbooru检测）', 'success');
            } else {
                updateToast(progressToast, '名称补全成功', 'success');
            }
        }
    } catch (error) {
        if (progressToast) {
            updateToast(progressToast, '自动补全失败: ' + error.message, 'error');
        } else {
            showToast('自动补全失败: ' + error.message, 'error');
        }
    }
});

// 取消画师编辑
document.getElementById('cancel-artist-btn').addEventListener('click', () => {
    hideModal('artist-modal');
});

// 添加分类
document.getElementById('add-category-btn').addEventListener('click', () => {
    document.getElementById('category-name').value = '';
    document.getElementById('category-order').value = '0';
    showModal('category-modal');
});

// 保存分类
document.getElementById('save-category-btn').addEventListener('click', async () => {
    const data = {
        name: document.getElementById('category-name').value.trim(),
        display_order: parseInt(document.getElementById('category-order').value)
    };

    if (!data.name) {
        showMessage('分类名称不能为空', 'error');
        return;
    }

    showLoading();
    try {
        await fetchAPI('/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showMessage('保存成功', 'success');
        hideModal('category-modal');
        loadCategories();
    } catch (error) {
        showMessage('保存失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 快速创建分类（从画师模态框中）
document.getElementById('quick-add-category-btn').addEventListener('click', async () => {
    const categoryName = prompt('请输入新分类的名称:');

    if (!categoryName || !categoryName.trim()) {
        return; // 用户取消或输入为空
    }

    const displayOrder = prompt('请输入显示顺序（数字）:', '0');
    const orderValue = parseInt(displayOrder) || 0;

    const data = {
        name: categoryName.trim(),
        display_order: orderValue
    };

    showLoading();
    try {
        const response = await fetchAPI('/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showMessage('分类创建成功', 'success');

        // 重新加载分类列表
        await loadCategories();

        // 自动将新创建的分类添加到已选分类中
        if (response.data && response.data.id) {
            addCategory(response.data.id);
        }

    } catch (error) {
        showMessage('创建分类失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 取消分类编辑
document.getElementById('cancel-category-btn').addEventListener('click', () => {
    hideModal('category-modal');
});

// 创建画师串
document.getElementById('create-preset-btn').addEventListener('click', async () => {
    if (allArtists.length === 0) {
        await loadArtists();
    }

    const select = document.getElementById('preset-artists');
    select.innerHTML = allArtists.map(artist => {
        const displayName = removeArtistPrefix(artist.name_nai) || artist.name_noob || 'Unknown';
        return `<option value="${artist.id}">${displayName}</option>`;
    }).join('');

    showModal('preset-modal');
});

// 保存画师串
document.getElementById('save-preset-btn').addEventListener('click', async () => {
    const select = document.getElementById('preset-artists');
    const selectedIds = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));

    if (selectedIds.length === 0) {
        showMessage('请至少选择一个画师', 'error');
        return;
    }

    const data = {
        name: document.getElementById('preset-name').value.trim(),
        description: document.getElementById('preset-desc').value.trim(),
        artist_ids: selectedIds
    };

    if (!data.name) {
        showMessage('名称不能为空', 'error');
        return;
    }

    showLoading();
    try {
        await fetchAPI('/presets', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showMessage('保存成功', 'success');
        hideModal('preset-modal');
        loadPresets();
    } catch (error) {
        showMessage('保存失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 取消画师串
document.getElementById('cancel-preset-btn').addEventListener('click', () => {
    hideModal('preset-modal');
});

// 批量自动补全 - 完整的自动化流程（仅处理数据缺失的画师）
document.getElementById('auto-complete-all-btn').addEventListener('click', async () => {
    // 获取当前显示的画师（考虑筛选条件）
    const targetArtists = getFilteredArtists();

    // 从目标画师中筛选出数据缺失的画师
    const incompleteArtists = targetArtists.filter(a => hasIncompleteData(a));

    let artistsToProcess = incompleteArtists;

    if (incompleteArtists.length === 0) {
        // 没有待补全的画师，询问是否重新执行
        const rerunConfirm = confirm('当前范围内所有画师数据已完整！\n\n是否要重新执行自动补全操作？\n（可用于更新数据、重新下载图片等）');

        if (!rerunConfirm) {
            return;
        }

        // 用户选择重新执行，使用所有当前筛选的画师
        artistsToProcess = targetArtists;

        if (artistsToProcess.length === 0) {
            showMessage('当前范围内没有画师', 'info');
            return;
        }
    }

    const confirmMessage = incompleteArtists.length === 0
        ? `将对当前 ${artistsToProcess.length} 个画师重新执行自动补全:\n1. 自动补全画师名称和链接\n2. 获取作品数量和下载示例图\n\n可能需要较长时间,是否继续?`
        : showIncompleteOnly
            ? `将对当前筛选的 ${artistsToProcess.length} 个待补全画师执行自动补全:\n1. 自动补全画师名称和链接\n2. 获取作品数量和下载示例图\n\n可能需要较长时间,是否继续?`
            : `检测到 ${artistsToProcess.length} 个待补全画师,将执行自动补全:\n1. 自动补全画师名称和链接\n2. 获取作品数量和下载示例图\n\n可能需要较长时间,是否继续?`;

    if (!confirm(confirmMessage)) {
        return;
    }

    const totalArtists = artistsToProcess.length;

    try {
        let artistsNeedingImages = [];

        // 第零阶段：检查缺失的本地图片文件
        const artistsWithImages = artistsToProcess.filter(a => a.image_example);
        if (artistsWithImages.length > 0) {
            showProgress('检查本地示例图', `正在检测 ${artistsWithImages.length} 个已保存的图片...`);
            updateProgress(0);

            try {
                const validateResult = await fetchAPI('/tools/validate-images', {
                    method: 'POST'
                });

                const invalidIds = validateResult.data || [];
                if (invalidIds.length > 0) {
                    // 只关心当前处理范围内的画师
                    const processingArtistIds = artistsToProcess.map(a => a.id);
                    artistsNeedingImages = invalidIds.filter(id => processingArtistIds.includes(id));

                    if (artistsNeedingImages.length > 0) {
                        showToast(`发现 ${artistsNeedingImages.length} 个画师缺失示例图,将重新下载`, 'warning', 3000);
                    }
                } else {
                    showToast('所有示例图文件均存在', 'success', 2000);
                }
            } catch (error) {
                console.error('检查示例图失败:', error);
                showToast('示例图检查失败,跳过此步骤', 'warning', 2000);
            }
        }

        // 第一阶段：自动补全名称和链接
        showProgress('自动补全画师信息', '正在处理第 0 / ' + totalArtists + ' 个画师...');
        updateProgress(5);

        let completedCount = 0;
        for (const artist of artistsToProcess) {
            completedCount++;
            const percent = 5 + (completedCount / totalArtists) * 40; // 5-45%
            updateProgress(
                percent,
                `正在处理第 ${completedCount} / ${totalArtists} 个画师: ${removeArtistPrefix(artist.name_nai) || artist.name_noob || '未命名'}`
            );

            await fetchAPI(`/artists/${artist.id}`, {
                method: 'PUT',
                body: JSON.stringify({ auto_complete: true })
            });
        }

        showToast('第一阶段完成：画师信息已自动补全', 'success', 2000);

        // 重新加载画师数据
        await loadArtists();

        // 第二阶段：获取作品数量和示例图
        // 需要获取数据的画师：没有作品数量、没有示例图、或图片URL无效的画师
        // 但要排除勾选了"跳过Danbooru检测"的画师
        const artistsNeedingData = artistsToProcess.filter(a => {
            // 如果勾选了跳过Danbooru检测，直接跳过
            if (a.skip_danbooru) {
                return false;
            }
            // 否则检查是否需要获取数据
            return !a.post_count || !a.image_example || artistsNeedingImages.includes(a.id);
        });

        if (artistsNeedingData.length > 0) {
            updateProgress(45, `准备获取 ${artistsNeedingData.length} 个画师的作品数据...`);

            showToast(`开始获取 ${artistsNeedingData.length} 个画师的作品数据`, 'info', 2000);

            // 分批处理，每次5个
            const batchSize = 5;
            let processedCount = 0;

            for (let i = 0; i < artistsNeedingData.length; i += batchSize) {
                const batch = artistsNeedingData.slice(i, i + batchSize);
                const batchIds = batch.map(a => a.id);

                const percent = 45 + (processedCount / artistsNeedingData.length) * 50; // 45-95%
                updateProgress(
                    percent,
                    `正在获取作品数据 ${processedCount + 1}-${Math.min(processedCount + batchSize, artistsNeedingData.length)} / ${artistsNeedingData.length}`
                );

                try {
                    const batchResult = await fetchAPI('/tools/fetch-post-counts', {
                        method: 'POST',
                        body: JSON.stringify({ artist_ids: batchIds })
                    });
                    processedCount += batch.length;

                    // 检查并显示详细结果
                    if (batchResult.details) {
                        const details = batchResult.details;

                        // 如果有警告或失败，显示具体信息
                        if (details.warnings && details.warnings.length > 0) {
                            console.warn('批次警告:', details.warnings);
                            showToast(`${details.warnings.length} 个画师未能下载图片`, 'warning', 3000);
                        }
                        if (details.failed && details.failed.length > 0) {
                            console.error('批次失败:', details.failed);
                            showToast(`${details.failed.length} 个画师数据获取失败`, 'error', 3000);
                        }
                    }
                } catch (error) {
                    console.error('批次处理失败:', error);
                    showToast(`部分数据获取失败: ${error.message}`, 'warning', 3000);
                }
            }

            showToast('第二阶段完成：作品数据已获取', 'success', 2000);
        } else {
            updateProgress(95, '所有画师数据已完整');
            showToast('所有画师数据已完整，无需获取', 'info', 2000);
        }

        // 完成
        updateProgress(100, '自动化流程已完成！');
        showToast('✨ 自动补全完成！', 'success', 3000);

        // 延迟隐藏进度条
        setTimeout(() => {
            hideProgress();
            loadArtists();
        }, 2000);

    } catch (error) {
        hideProgress();
        showMessage('自动补全失败: ' + error.message, 'error');
    }
});

// 查找重复
document.getElementById('find-duplicates-btn').addEventListener('click', async () => {
    showLoading();
    try {
        const result = await fetchAPI('/tools/find-duplicates');
        const duplicates = result.data;

        const resultBox = document.getElementById('duplicates-result');
        if (duplicates.length === 0) {
            resultBox.innerHTML = '<p class="text-gray-500">未发现重复画师</p>';
        } else {
            resultBox.innerHTML = `<p class="mb-3 font-semibold text-gray-700">发现 ${duplicates.length} 个重复画师:</p>` +
                duplicates.map(dup => `
                    <div class="mb-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <strong class="text-gray-800">${removeArtistPrefix(dup.name_nai) || dup.name_noob}</strong>
                        <span class="text-gray-600 ml-2">- ${dup.category_name}</span>
                    </div>
                `).join('');
        }
    } catch (error) {
        showMessage('查找重复失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 测试自动补全
document.getElementById('test-auto-complete-btn').addEventListener('click', async () => {
    const data = {
        name_noob: document.getElementById('test-noob').value.trim(),
        name_nai: document.getElementById('test-nai').value.trim(),
        danbooru_link: document.getElementById('test-link').value.trim()
    };

    try {
        const result = await fetchAPI('/tools/auto-complete', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        document.getElementById('test-noob').value = result.data.name_noob;
        document.getElementById('test-nai').value = result.data.name_nai;
        document.getElementById('test-link').value = result.data.danbooru_link;
        showMessage('自动补全成功', 'success');
    } catch (error) {
        showMessage('自动补全失败: ' + error.message, 'error');
    }
});

// 导出JSON
document.getElementById('export-json-btn').addEventListener('click', async () => {
    try {
        const result = await fetchAPI('/export/json');
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '画师整理.json';
        a.click();
        showMessage('导出成功', 'success');
    } catch (error) {
        showMessage('导出失败: ' + error.message, 'error');
    }
});

// 导出Excel
document.getElementById('export-excel-btn').addEventListener('click', () => {
    window.open(`${API_BASE}/export/excel`, '_blank');
});

// 导入Excel
document.getElementById('import-excel-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-excel-file');
    if (!fileInput.files.length) {
        showMessage('请选择文件', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    showLoading();
    try {
        const response = await fetch(`${API_BASE}/import/excel`, {
            method: 'POST',
            credentials: 'include',  // 重要：携带cookie
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            showMessage(result.message, 'success');
            loadArtists();
            loadCategories();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showMessage('导入失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// 导入JSON
document.getElementById('import-json-btn').addEventListener('click', async () => {
    const jsonText = document.getElementById('import-json-text').value.trim();
    if (!jsonText) {
        showMessage('请输入JSON数据', 'error');
        return;
    }

    try {
        const data = JSON.parse(jsonText);
        showLoading();

        const result = await fetchAPI('/import/json', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showMessage(result.message, 'success');
        loadArtists();
        loadCategories();
    } catch (error) {
        showMessage('导入失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// ================== 工具函数 - 复制到剪贴板 ==================

window.copyToClipboard = async function(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label}格式已复制`, 'success', 2000);
    } catch (err) {
        // 降级方案：使用旧的复制方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(`${label}格式已复制`, 'success', 2000);
        } catch (err2) {
            showToast('复制失败', 'error', 2000);
        }
        document.body.removeChild(textArea);
    }
}

// ================== 初始化 ==================

async function init() {
    showLoading();
    try {
        await loadCategories();
        await loadArtists();
    } catch (error) {
        showMessage('初始化失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
