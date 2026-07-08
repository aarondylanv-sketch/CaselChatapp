// ============ APP STATE ============
let currentUser = null;
let userProfile = null;
let activeChatId = null;
let activeChatData = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;
let selectedMessageId = null;
let selectedMessageData = null;
let isOnline = navigator.onLine;

// ============ ONLINE/OFFLINE ============
window.addEventListener('online', () => {
    isOnline = true;
    document.getElementById('offlineBanner').style.display = 'none';
    document.getElementById('loginBtn').disabled = false;
    document.getElementById('signupBtn').disabled = false;
    document.getElementById('onlineStatus').innerHTML = '🟢 Online';
    document.getElementById('onlineStatus').style.color = '#3fb950';
    if (currentUser) loadChats();
});

window.addEventListener('offline', () => {
    isOnline = false;
    document.getElementById('offlineBanner').style.display = 'block';
    document.getElementById('loginBtn').disabled = true;
    document.getElementById('signupBtn').disabled = true;
    document.getElementById('onlineStatus').innerHTML = '🔴 Offline';
    document.getElementById('onlineStatus').style.color = '#f85149';
});

// ============ SIDEBAR TOGGLE ============
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Close sidebar when clicking chat area on mobile
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chatMain').addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    });
});

// ============ PROFILE ============
function openProfile() {
    document.getElementById('profileNickname').value = userProfile.nickname || '';
    document.getElementById('profileEmail').textContent = '•••••••• (tap to view)';
    document.getElementById('profileEmail').onclick = showEmail;
    document.getElementById('hidePfp').checked = userProfile.hidePfp || false;
    document.getElementById('appLockToggle').checked = userProfile.appLockPin ? true : false;
    updateProfilePicDisplay();
    document.getElementById('profileModal').style.display = 'flex';
}

function showEmail() {
    showCustomPrompt('Enter password to view email:', (password) => {
        if (!password) return;
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
        currentUser.reauthenticateWithCredential(credential)
            .then(() => {
                document.getElementById('profileEmail').textContent = currentUser.email;
                document.getElementById('profileEmail').onclick = null;
                document.getElementById('profileEmail').style.cursor = 'default';
            })
            .catch(() => showCustomAlert('Wrong password', '❌'));
    });
}

async function updateProfile() {
    const nickname = document.getElementById('profileNickname').value.trim();
    if (!nickname || nickname.length > 20 || !/^[a-zA-Z]+$/.test(nickname)) {
        showCustomAlert('Letters only, max 20 characters', '⚠️');
        return;
    }
    await db.collection('users').doc(currentUser.uid).update({ nickname });
    
    // Update nickname in all chats
    const chatsSnapshot = await db.collection('chats').where('members', 'array-contains', currentUser.uid).get();
    for (const chatDoc of chatsSnapshot.docs) {
        await chatDoc.ref.update({
            [`memberNicknames.${currentUser.uid}`]: nickname
        });
    }
    
    userProfile.nickname = nickname;
    closeModal('profileModal');
    showCustomAlert('Profile updated! Nickname synced across all chats.', '✅');
    loadChats();
}

async function toggleHidePfp() {
    const hide = document.getElementById('hidePfp').checked;
    await db.collection('users').doc(currentUser.uid).update({ hidePfp: hide });
    userProfile.hidePfp = hide;
}

async function showPfpExceptions() {
    const list = document.getElementById('pfpExceptionsList');
    list.innerHTML = '';
    
    const snapshot = await db.collection('chats').where('members', 'array-contains', currentUser.uid).get();
    
    snapshot.forEach(doc => {
        const chat = doc.data();
        const div = document.createElement('div');
        div.className = 'perm-item';
        
        const isException = (userProfile.pfpExceptions || []).includes(doc.id);
        
        div.innerHTML = `
            <span>${chat.title || 'Untitled Chat'}</span>
            <input type="checkbox" ${isException ? 'checked' : ''} onchange="togglePfpException('${doc.id}', this.checked)">
        `;
        list.appendChild(div);
    });
    
    document.getElementById('pfpExceptionsModal').style.display = 'flex';
}

async function togglePfpException(chatId, add) {
    let exceptions = userProfile.pfpExceptions || [];
    if (add) {
        if (!exceptions.includes(chatId)) exceptions.push(chatId);
    } else {
        exceptions = exceptions.filter(id => id !== chatId);
    }
    await db.collection('users').doc(currentUser.uid).update({ pfpExceptions: exceptions });
    userProfile.pfpExceptions = exceptions;
}

async function savePfpExceptions() {
    closeModal('pfpExceptionsModal');
    showCustomAlert('Privacy settings saved!', '✅');
}

function updateProfilePicDisplay() {
    const textEl = document.getElementById('profilePicText');
    const imgEl = document.getElementById('profilePicImg');
    
    if (userProfile?.profilePic) {
        if (textEl) textEl.style.display = 'none';
        if (imgEl) {
            imgEl.style.display = 'block';
            imgEl.src = userProfile.profilePic;
        }
    } else {
        if (textEl) textEl.style.display = 'block';
        if (imgEl) imgEl.style.display = 'none';
    }
}

// ============ CHATS ============
async function loadChats() {
    if (!currentUser) return;
    if (unsubscribeChats) unsubscribeChats();
    
    const chatList = document.getElementById('chatList');
    
    unsubscribeChats = db.collection('chats')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot(async snapshot => {
            chatList.innerHTML = '';
            
            if (snapshot.empty) {
                chatList.innerHTML = '<div class="empty-state">No chats yet<br><small>Create or join a chat</small></div>';
                return;
            }

            for (const doc of snapshot.docs) {
                const chat = doc.data();
                
                // Check if user is kicked
                if (chat.kickedMembers && chat.kickedMembers.includes(currentUser.uid)) {
                    // Remove from members if kicked but still showing
                    if (chat.members.includes(currentUser.uid)) {
                        await doc.ref.update({
                            members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
                        });
                    }
                    continue; // Don't show kicked chats
                }
                
                const div = document.createElement('div');
                div.className = 'chat-item';
                if (activeChatId === doc.id) div.classList.add('active');
                div.onclick = () => { openChat(doc.id, chat); if (window.innerWidth <= 768) toggleSidebar(); };
                
                // Get creator's profile pic for chat avatar
                let avatarHtml = (chat.title || 'C')[0].toUpperCase();
                const creatorDoc = await db.collection('users').doc(chat.createdBy).get();
                const creatorData = creatorDoc.data();
                
                if (creatorData?.profilePic && !creatorData?.hidePfp) {
                    avatarHtml = `<img src="${creatorData.profilePic}" alt="">`;
                }
                
                div.innerHTML = `
                    <div class="chat-item-avatar">${avatarHtml}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-title">${chat.title || 'Untitled Chat'}</div>
                        <div class="chat-item-preview">${chat.members.length} members</div>
                    </div>
                `;
                chatList.appendChild(div);
            }
        });
}

function showNewChatModal() {
    document.getElementById('newChatModal').style.display = 'flex';
    document.getElementById('generatedCodeDisplay').style.display = 'none';
    document.getElementById('inviteCodeInput').value = '';
    document.getElementById('inviteError').style.display = 'none';
}

async function generateInviteCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await db.collection('chats').add({
        title: `${userProfile.nickname}'s Chat`,
        members: [currentUser.uid],
        memberNicknames: { [currentUser.uid]: userProfile.nickname },
        memberColors: { [currentUser.uid]: 0 },
        inviteCode: code,
        inviteUses: 0,
        maxInviteUses: 20,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        kickedMembers: [],
        memberPermissions: {},
        defaultPermissions: {
            sendMessages: true,
            changeTitle: true,
            kickMembers: false,
            viewCode: true
        }
    });
    
    document.getElementById('generatedCode').textContent = code;
    document.getElementById('generatedCodeDisplay').style.display = 'block';
}

function copyGeneratedCode() {
    navigator.clipboard.writeText(document.getElementById('generatedCode').textContent);
    showCustomAlert('Code copied!', '✅');
}

async function joinByInviteCode() {
    const code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
    const errorEl = document.getElementById('inviteError');
    
    if (!code) {
        errorEl.textContent = 'Enter code';
        errorEl.style.display = 'block';
        return;
    }
    
    const snapshot = await db.collection('chats').where('inviteCode', '==', code).get();
    
    if (snapshot.empty) {
        errorEl.textContent = 'Invalid code';
        errorEl.style.display = 'block';
        return;
    }
    
    const chatDoc = snapshot.docs[0];
    const chat = chatDoc.data();
    
    // Check if kicked
    if (chat.kickedMembers && chat.kickedMembers.includes(currentUser.uid)) {
        errorEl.textContent = 'You have been removed from this chat';
        errorEl.style.display = 'block';
        return;
    }
    
    if (chat.inviteUses >= chat.maxInviteUses) {
        errorEl.textContent = 'Chat full (20/20)';
        errorEl.style.display = 'block';
        return;
    }
    
    if (chat.members.includes(currentUser.uid)) {
        errorEl.textContent = 'Already in chat';
        errorEl.style.display = 'block';
        return;
    }
    
    // Assign a random color index
    const colorIndex = chat.members.length % 20;
    
    await db.collection('chats').doc(chatDoc.id).update({
        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        [`memberNicknames.${currentUser.uid}`]: userProfile.nickname,
        [`memberColors.${currentUser.uid}`]: colorIndex,
        inviteUses: chat.inviteUses + 1
    });
    
    closeModal('newChatModal');
}

// ============ MESSAGES ============
function openChat(chatId, chatData) {
    if (unsubscribeMessages) unsubscribeMessages();
    
    activeChatId = chatId;
    activeChatData = chatData;
    
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChat').style.display = 'flex';
    document.getElementById('chatTitle').textContent = chatData.title || 'Untitled Chat';
    document.getElementById('chatMeta').textContent = `${chatData.members.length}/20 members`;
    
    // Highlight active chat
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    
    loadMessages();
}

function loadMessages() {
    if (!activeChatId) return;
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    unsubscribeMessages = db.collection('chats')
        .doc(activeChatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isOutgoing = msg.senderId === currentUser.uid;
                const time = msg.timestamp ? 
                    new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                
                // Get sender color
                const colorIndex = activeChatData?.memberColors?.[msg.senderId] || 0;
                const senderColor = getMemberColorHex(colorIndex);
                
                const wrapper = document.createElement('div');
                wrapper.className = `msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
                wrapper.setAttribute('data-message-id', doc.id);
                
                wrapper.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    selectedMessageId = doc.id;
                    selectedMessageData = msg;
                    showContextMenu(e.clientX, e.clientY, msg.senderId === currentUser.uid);
                });
                
                wrapper.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    selectedMessageId = doc.id;
                    selectedMessageData = msg;
                    showContextMenu(e.clientX, e.clientY, msg.senderId === currentUser.uid);
                });
                
                wrapper.innerHTML = `
                    ${!isOutgoing ? `<div class="msg-sender" style="color:${senderColor}">${msg.senderNickname || 'Unknown'}</div>` : ''}
                    <div class="msg-bubble">${escapeHtml(msg.text)}</div>
                    <div class="msg-time">${time}</div>
                `;
                container.appendChild(wrapper);
            });
            
            container.scrollTop = container.scrollHeight;
        });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    if (!activeChatId) return;
    
    // Check permission
    const canSend = await hasPermission(currentUser.uid, 'sendMessages');
    if (!canSend) {
        showCustomAlert('You do not have permission to send messages', '🔒');
        return;
    }
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    await db.collection('chats').doc(activeChatId).collection('messages').add({
        text: text,
        senderId: currentUser.uid,
        senderNickname: userProfile.nickname,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
}

// ============ CONTEXT MENU ============
function showContextMenu(x, y, isOwn) {
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
    
    const items = menu.querySelectorAll('.context-item');
    items[1].style.display = isOwn ? 'flex' : 'none'; // Edit
    items[2].style.display = isOwn ? 'flex' : 'none'; // Delete for everyone
    
    setTimeout(() => {
        document.addEventListener('click', closeContextMenu, {once: true});
        document.addEventListener('touchstart', closeContextMenu, {once: true});
    }, 100);
}

function closeContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
}

function copyMessage() {
    if (selectedMessageData) {
        navigator.clipboard.writeText(selectedMessageData.text);
    }
    closeContextMenu();
}

function editMessage() {
    if (!selectedMessageData || selectedMessageData.senderId !== currentUser.uid) return;
    document.getElementById('editMessageInput').value = selectedMessageData.text;
    document.getElementById('editMessageModal').style.display = 'flex';
    closeContextMenu();
}

async function saveEditedMessage() {
    const newText = document.getElementById('editMessageInput').value.trim();
    if (!newText || !selectedMessageId) return;
    
    await db.collection('chats').doc(activeChatId).collection('messages')
        .doc(selectedMessageId).update({ text: newText });
    
    closeModal('editMessageModal');
    selectedMessageId = null;
}

async function deleteMessage() {
    if (!selectedMessageId || selectedMessageData?.senderId !== currentUser.uid) return;
    
    showCustomConfirm('Delete this message for everyone?', async (confirmed) => {
        if (!confirmed) return;
        await db.collection('chats').doc(activeChatId).collection('messages')
            .doc(selectedMessageId).delete();
        closeContextMenu();
        selectedMessageId = null;
    });
}

function deleteForMe() {
    const el = document.querySelector(`[data-message-id="${selectedMessageId}"]`);
    if (el) el.remove();
    closeContextMenu();
}

// ============ CHAT SETTINGS ============
async function openChatSettings() {
    if (!activeChatId) return;
    
    const doc = await db.collection('chats').doc(activeChatId).get();
    const chat = doc.data();
    activeChatData = chat;
    
    // Show group code
    document.getElementById('groupCodeDisplay').textContent = chat.inviteCode || '------';
    document.getElementById('settingsTitle').value = chat.title || '';
    document.getElementById('memberCount').textContent = chat.members.length;
    
    // Load default permissions
    const defPerms = chat.defaultPermissions || {
        sendMessages: true,
        changeTitle: true,
        kickMembers: false,
        viewCode: true
    };
    
    document.getElementById('defSendMsg').checked = defPerms.sendMessages !== false;
    document.getElementById('defChangeTitle').checked = defPerms.changeTitle === true;
    document.getElementById('defKick').checked = defPerms.kickMembers === true;
    document.getElementById('defViewCode').checked = defPerms.viewCode !== false;
    
    // Hide permission settings for non-owners
    const isOwner = chat.createdBy === currentUser.uid;
    const permSections = document.querySelectorAll('#chatSettingsModal .settings-group');
    if (permSections.length >= 4) {
        permSections[2].style.display = isOwner ? 'block' : 'none'; // Member list clickable for owner
        permSections[3].style.display = isOwner ? 'block' : 'none'; // Default perms for owner
    }
    
    // Load members
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    let index = 0;
    for (const uid of chat.members) {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        const isUserOnline = userData?.lastSeen ? 
            (Date.now() - userData.lastSeen.toDate().getTime()) < 5 * 60 * 1000 : false;
        const colorIndex = chat.memberColors?.[uid] || index;
        const memberColor = getMemberColorHex(colorIndex);
        
        const div = document.createElement('div');
        div.className = 'member-item';
        
        if (isOwner && uid !== currentUser.uid) {
            div.onclick = () => openPermissions(uid, chat.memberNicknames?.[uid] || 'Unknown');
            div.style.cursor = 'pointer';
        }
        
        div.innerHTML = `
            <span>
                <span class="member-color" style="background:${memberColor}"></span>
                ${chat.memberNicknames?.[uid] || 'Unknown'}
                ${uid === chat.createdBy ? ' 👑' : ''}
                ${uid === currentUser.uid ? ' (You)' : ''}
            </span>
            <span class="member-status ${isUserOnline ? 'online' : 'offline'}">
                ${isUserOnline ? '🟢' : '⚫'}
            </span>
        `;
        memberList.appendChild(div);
        index++;
    }
    
    document.getElementById('chatSettingsModal').style.display = 'flex';
}

async function changeChatTitle() {
    if (!activeChatId) return;
    
    // Check permission
    const canChange = await hasPermission(currentUser.uid, 'changeTitle');
    if (!canChange) {
        showCustomAlert('You do not have permission to change the title', '🔒');
        return;
    }
    
    const title = document.getElementById('settingsTitle').value.trim();
    if (!title) return;
    
    await db.collection('chats').doc(activeChatId).update({ title });
    document.getElementById('chatTitle').textContent = title;
    closeModal('chatSettingsModal');
    showCustomAlert('Title updated!', '✅');
}

async function deleteChat() {
    if (!activeChatId) return;
    
    const chatDoc = await db.collection('chats').doc(activeChatId).get();
    const chat = chatDoc.data();
    
    if (chat.createdBy !== currentUser.uid) {
        showCustomAlert('Only the owner can delete this chat', '🔒');
        return;
    }
    
    showCustomConfirm('Delete entire chat for everyone? This cannot be undone.', async (confirmed) => {
        if (!confirmed) return;
        
        const msgs = await db.collection('chats').doc(activeChatId).collection('messages').get();
        for (const d of msgs.docs) await d.ref.delete();
        await db.collection('chats').doc(activeChatId).delete();
        
        activeChatId = null;
        document.getElementById('activeChat').style.display = 'none';
        document.getElementById('noChatSelected').style.display = 'flex';
        closeModal('chatSettingsModal');
        showCustomAlert('Chat deleted', '✅');
    });
}

async function leaveChat() {
    if (!activeChatId) return;
    
    showCustomConfirm('Leave this chat? You can rejoin with a new invite code.', async (confirmed) => {
        if (!confirmed) return;
        
        await db.collection('chats').doc(activeChatId).update({
            members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        });
        
        activeChatId = null;
        document.getElementById('activeChat').style.display = 'none';
        document.getElementById('noChatSelected').style.display = 'flex';
        closeModal('chatSettingsModal');
    });
}

// ============ HELPERS ============
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Close modals on overlay click
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// ============ INITIAL SETUP ============
document.addEventListener('DOMContentLoaded', () => {
    updateOnlineStatus();
    
    // Focus pin input when lock screen shown
    const lockObserver = new MutationObserver(() => {
        const lockScreen = document.getElementById('lockScreen');
        if (lockScreen.style.display === 'flex') {
            document.getElementById('pinInput')?.focus();
        }
    });
    
    const lockScreen = document.getElementById('lockScreen');
    if (lockScreen) {
        lockObserver.observe(lockScreen, { attributes: true, attributeFilter: ['style'] });
    }
});

function updateOnlineStatus() {
    const statusEl = document.getElementById('onlineStatus');
    if (!statusEl) return;
    if (isOnline) {
        statusEl.innerHTML = '🟢 Online';
        statusEl.style.color = '#3fb950';
    } else {
        statusEl.innerHTML = '🔴 Offline';
        statusEl.style.color = '#f85149';
    }
}