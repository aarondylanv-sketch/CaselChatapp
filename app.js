// ============ STATE ============
let currentUser = null;
let userProfile = null;
let activeChatId = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;
let selectedMessageId = null;
let selectedMessageData = null;
let isOnline = navigator.onLine;
let resetEmail = '';
let resetCooldown = false;
let resetTimer = null;
let confirmCallback = null;
let promptCallback = null;

// ============ CUSTOM DIALOGS ============
function showCustomAlert(message, icon = '⚠️') {
    document.getElementById('alertIcon').textContent = icon;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('customAlert').style.display = 'flex';
}

function closeCustomAlert() {
    document.getElementById('customAlert').style.display = 'none';
}

function showCustomConfirm(message, callback) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('customConfirm').style.display = 'flex';
    confirmCallback = callback;
}

function confirmAction(result) {
    document.getElementById('customConfirm').style.display = 'none';
    if (confirmCallback) confirmCallback(result);
    confirmCallback = null;
}

function showCustomPrompt(message, callback) {
    document.getElementById('promptMessage').textContent = message;
    document.getElementById('promptInput').value = '';
    document.getElementById('customPrompt').style.display = 'flex';
    promptCallback = callback;
}

function promptAction(result) {
    const value = document.getElementById('promptInput').value;
    document.getElementById('customPrompt').style.display = 'none';
    if (promptCallback) promptCallback(result ? value : null);
    promptCallback = null;
}

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

// ============ SIDEBAR TOGGLE (MOBILE) ============
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ============ FORM NAVIGATION ============
function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'block';
    document.getElementById('resetForm').style.display = 'none';
    document.getElementById('forgotError').style.display = 'none';
    document.getElementById('forgotEmail').value = '';
}

// ============ TERMS & PRIVACY ============
function showTerms() {
    document.getElementById('termsModal').style.display = 'flex';
}

function showPrivacyPolicyText() {
    document.getElementById('privacyModal').style.display = 'flex';
}

// ============ AUTH FUNCTIONS ============
async function signupUser() {
    if (!isOnline) {
        showCustomAlert('No internet connection. Please check your network.');
        return;
    }

    const nickname = document.getElementById('signupNickname').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const agreed = document.getElementById('agreeTerms').checked;
    const errorEl = document.getElementById('signupError');

    if (!agreed) {
        errorEl.textContent = 'You must agree to Terms & Conditions and Privacy Policy';
        errorEl.style.display = 'block';
        return;
    }
    if (!nickname || nickname.length > 20 || !/^[a-zA-Z]+$/.test(nickname)) {
        errorEl.textContent = 'Nickname: letters only, max 20 characters';
        errorEl.style.display = 'block';
        return;
    }
    if (!email || password.length < 6) {
        errorEl.textContent = 'Valid email and password (6+ chars) required';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            nickname: nickname,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        errorEl.style.display = 'none';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            errorEl.textContent = 'This email is already registered. Please log in.';
        } else {
            errorEl.textContent = error.message.replace('Firebase: ', '').replace('Error: ', '');
        }
        errorEl.style.display = 'block';
    }
}

async function loginUser() {
    if (!isOnline) {
        showCustomAlert('No internet connection. Please check your network.');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    if (!email || !password) {
        errorEl.textContent = 'Enter email and password';
        errorEl.style.display = 'block';
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
        errorEl.style.display = 'none';
    } catch (error) {
        errorEl.textContent = 'Invalid email or password';
        errorEl.style.display = 'block';
    }
}

// ============ FORGOT PASSWORD ============
async function sendResetCode() {
    const email = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');

    if (!email) {
        errorEl.textContent = 'Enter your email address';
        errorEl.style.display = 'block';
        return;
    }

    if (resetCooldown) {
        errorEl.textContent = 'Please wait 60 seconds before requesting another code';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const snapshot = await db.collection('users').where('email', '==', email).get();
        if (snapshot.empty) {
            errorEl.textContent = 'No account found with this email';
            errorEl.style.display = 'block';
            return;
        }

        resetEmail = email;
        const code = Math.floor(1000000 + Math.random() * 9000000).toString();

        await db.collection('resetCodes').doc(email).set({
            code: code,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        // Send via Firebase email
        await auth.sendPasswordResetEmail(email, {
            url: window.location.origin + '/?code=' + code,
            handleCodeInApp: true
        });

        // Store the code in a way Firebase can use
        await db.collection('mailCodes').add({
            to: email,
            message: {
                subject: 'Casel - Password Reset Code',
                text: `Your 7-digit verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`
            }
        });

        showCustomAlert('Verification code sent!\n\nCheck your email for the 7-digit code.\nFor testing: ' + code, '📧');

        document.getElementById('forgotForm').style.display = 'none';
        document.getElementById('resetForm').style.display = 'block';
        document.getElementById('resetError').style.display = 'none';
        document.getElementById('resetCode').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        resetCooldown = true;
        let seconds = 60;
        resetTimer = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(resetTimer);
                resetCooldown = false;
            }
        }, 1000);

        errorEl.style.display = 'none';

    } catch (error) {
        errorEl.textContent = error.message.replace('Firebase: ', '');
        errorEl.style.display = 'block';
    }
}

async function resetPassword() {
    const code = document.getElementById('resetCode').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('resetError');

    if (!code || code.length !== 7) {
        errorEl.textContent = 'Enter the 7-digit verification code';
        errorEl.style.display = 'block';
        return;
    }
    if (newPassword.length < 6) {
        errorEl.textContent = 'New password must be at least 6 characters';
        errorEl.style.display = 'block';
        return;
    }
    if (newPassword !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const doc = await db.collection('resetCodes').doc(resetEmail).get();
        
        if (!doc.exists) {
            errorEl.textContent = 'No reset code found. Request a new one.';
            errorEl.style.display = 'block';
            return;
        }

        const data = doc.data();
        if (new Date() > data.expiresAt.toDate()) {
            errorEl.textContent = 'Code expired. Please request a new one.';
            errorEl.style.display = 'block';
            await db.collection('resetCodes').doc(resetEmail).delete();
            return;
        }
        if (data.code !== code) {
            errorEl.textContent = 'Invalid verification code';
            errorEl.style.display = 'block';
            return;
        }

        // Update password
        await db.collection('passwordChanges').doc(resetEmail).set({
            newPassword: newPassword,
            verified: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('resetCodes').doc(resetEmail).delete();
        await auth.sendPasswordResetEmail(resetEmail);

        showCustomAlert('Password reset successful!\n\nCheck your email for the reset link, then log in with your new password.', '✅');

        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('loginEmail').value = resetEmail;
        document.getElementById('loginPassword').value = '';
        resetEmail = '';

    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.style.display = 'block';
    }
}

// ============ AUTH STATE LISTENER ============
auth.onAuthStateChanged(async (user) => {
    const authScreen = document.getElementById('authScreen');
    const mainScreen = document.getElementById('mainScreen');

    if (user) {
        currentUser = user;
        
        // Check for pending password change
        const pwdDoc = await db.collection('passwordChanges').doc(user.email).get();
        if (pwdDoc.exists && pwdDoc.data().verified) {
            await db.collection('users').doc(user.uid).update({
                lastPasswordChange: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('passwordChanges').doc(user.email).delete();
        }

        // Update last seen
        await db.collection('users').doc(user.uid).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });

        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            userProfile = doc.data();
            authScreen.classList.remove('active');
            mainScreen.classList.add('active');
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            loadChats();
        }
    } else {
        currentUser = null;
        userProfile = null;
        activeChatId = null;
        mainScreen.classList.remove('active');
        authScreen.classList.add('active');
        showLogin();
        if (unsubscribeChats) unsubscribeChats();
    }
});

async function logoutUser() {
    await auth.signOut();
    closeModal('profileModal');
}

// ============ DELETE ACCOUNT ============
async function deleteAccount() {
    showCustomConfirm('DELETE ACCOUNT?\n\nThis action is UNRECOVERABLE.\nAll your data will be permanently deleted.', async (confirmed) => {
        if (!confirmed) return;

        showCustomPrompt('Enter your password to confirm:', async (password) => {
            if (!password) return;

            try {
                const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
                await currentUser.reauthenticateWithCredential(credential);

                const chatsSnapshot = await db.collection('chats').where('members', 'array-contains', currentUser.uid).get();
                for (const chatDoc of chatsSnapshot.docs) {
                    const msgs = await db.collection('chats').doc(chatDoc.id).collection('messages').get();
                    for (const msgDoc of msgs.docs) await msgDoc.ref.delete();
                    if (chatDoc.data().createdBy === currentUser.uid) {
                        await chatDoc.ref.delete();
                    } else {
                        await chatDoc.ref.update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
                    }
                }

                await db.collection('users').doc(currentUser.uid).delete();
                await currentUser.delete();
                showCustomAlert('Account deleted. You can create a new one with the same email.', '✅');
            } catch (error) {
                if (error.code === 'auth/wrong-password') {
                    showCustomAlert('Wrong password. Account not deleted.', '❌');
                } else {
                    showCustomAlert(error.message, '❌');
                }
            }
        });
    });
}

// ============ PROFILE ============
function openProfile() {
    document.getElementById('profileNickname').value = userProfile.nickname;
    document.getElementById('profileEmail').textContent = '•••••••• (tap to view)';
    document.getElementById('profileEmail').onclick = showEmail;
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
    userProfile.nickname = nickname;
    closeModal('profileModal');
    showCustomAlert('Profile updated!', '✅');
}

// ============ CHATS ============
async function loadChats() {
    if (!currentUser) return;
    if (unsubscribeChats) unsubscribeChats();
    const chatList = document.getElementById('chatList');
    unsubscribeChats = db.collection('chats').where('members', 'array-contains', currentUser.uid)
        .onSnapshot(snapshot => {
            chatList.innerHTML = '';
            if (snapshot.empty) {
                chatList.innerHTML = '<div class="empty-state">No chats yet<br><small>Create or join a chat</small></div>';
                return;
            }
            snapshot.forEach(doc => {
                const chat = doc.data();
                const div = document.createElement('div');
                div.className = 'chat-item';
                if (activeChatId === doc.id) div.classList.add('active');
                div.onclick = () => { openChat(doc.id, chat); toggleSidebar(); };
                div.innerHTML = `
                    <div class="chat-item-avatar">${(chat.title||'C')[0].toUpperCase()}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-title">${chat.title||'Untitled Chat'}</div>
                        <div class="chat-item-preview">${chat.members.length} members</div>
                    </div>`;
                chatList.appendChild(div);
            });
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
        inviteCode: code,
        inviteUses: 0,
        maxInviteUses: 20,
        createdBy: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        kickedMembers: []
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
    if (!code) { errorEl.textContent = 'Enter code'; errorEl.style.display = 'block'; return; }
    
    const snapshot = await db.collection('chats').where('inviteCode','==',code).get();
    if (snapshot.empty) { errorEl.textContent = 'Invalid code'; errorEl.style.display = 'block'; return; }
    
    const chatDoc = snapshot.docs[0];
    const chat = chatDoc.data();
    
    // Check if kicked
    if (chat.kickedMembers && chat.kickedMembers.includes(currentUser.uid)) {
        errorEl.textContent = 'You have been removed from this chat';
        errorEl.style.display = 'block';
        return;
    }
    
    if (chat.inviteUses >= chat.maxInviteUses) { errorEl.textContent = 'Chat full (20/20)'; errorEl.style.display = 'block'; return; }
    if (chat.members.includes(currentUser.uid)) { errorEl.textContent = 'Already in chat'; errorEl.style.display = 'block'; return; }
    
    await db.collection('chats').doc(chatDoc.id).update({
        members: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        [`memberNicknames.${currentUser.uid}`]: userProfile.nickname,
        inviteUses: chat.inviteUses + 1
    });
    closeModal('newChatModal');
}

// ============ MESSAGES ============
function openChat(chatId, chatData) {
    if (unsubscribeMessages) unsubscribeMessages();
    activeChatId = chatId;
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChat').style.display = 'flex';
    document.getElementById('chatTitle').textContent = chatData.title || 'Untitled Chat';
    document.getElementById('chatMeta').textContent = `${chatData.members.length}/20 members`;
    loadMessages();
}

function loadMessages() {
    if (!activeChatId) return;
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    unsubscribeMessages = db.collection('chats').doc(activeChatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const isOutgoing = msg.senderId === currentUser.uid;
                const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
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
                    ${!isOutgoing ? `<div class="msg-sender">${msg.senderNickname||'Unknown'}</div>` : ''}
                    <div class="msg-bubble">${msg.text}</div>
                    <div class="msg-time">${time}</div>`;
                container.appendChild(wrapper);
            });
            container.scrollTop = container.scrollHeight;
        });
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !activeChatId) return;
    await db.collection('chats').doc(activeChatId).collection('messages').add({
        text, senderId: currentUser.uid, senderNickname: userProfile.nickname,
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
    items[1].style.display = isOwn ? 'flex' : 'none';
    items[2].style.display = isOwn ? 'flex' : 'none';
    items[3].style.display = isOwn ? 'none' : 'flex';
    
    setTimeout(() => document.addEventListener('click', closeContextMenu, {once: true}), 100);
    setTimeout(() => document.addEventListener('touchstart', closeContextMenu, {once: true}), 100);
}

function closeContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
}

function copyMessage() {
    if (selectedMessageData) navigator.clipboard.writeText(selectedMessageData.text);
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
    await db.collection('chats').doc(activeChatId).collection('messages').doc(selectedMessageId).update({ text: newText });
    closeModal('editMessageModal');
}

async function deleteMessage() {
    if (!selectedMessageId || selectedMessageData?.senderId !== currentUser.uid) return;
    showCustomConfirm('Delete this message for everyone?', async (confirmed) => {
        if (confirmed) {
            await db.collection('chats').doc(activeChatId).collection('messages').doc(selectedMessageId).delete();
        }
    });
    closeContextMenu();
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
    document.getElementById('settingsTitle').value = chat.title || '';
    document.getElementById('memberCount').textContent = chat.members.length;
    
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    
    for (const uid of chat.members) {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        const isOnline = userData?.lastSeen ? 
            (Date.now() - userData.lastSeen.toDate().getTime()) < 5 * 60 * 1000 : false;
        
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <span>${chat.memberNicknames?.[uid]||'Unknown'} ${uid===chat.createdBy?'👑':''} ${uid===currentUser.uid?'(You)':''}</span>
            <span class="member-status ${isOnline ? 'online' : 'offline'}">${isOnline ? '🟢' : '⚫'}</span>
            ${currentUser.uid === chat.createdBy && uid !== currentUser.uid ? 
                `<button onclick="kickMember('${uid}')" class="kick-btn">Kick</button>` : ''}
        `;
        memberList.appendChild(div);
    }
    
    document.getElementById('chatSettingsModal').style.display = 'flex';
}

async function kickMember(uid) {
    showCustomConfirm('Remove this member from the chat?', async (confirmed) => {
        if (!confirmed) return;
        
        const doc = await db.collection('chats').doc(activeChatId).get();
        const chat = doc.data();
        
        await db.collection('chats').doc(activeChatId).update({
            members: firebase.firestore.FieldValue.arrayRemove(uid),
            kickedMembers: firebase.firestore.FieldValue.arrayUnion(uid)
        });
        
        openChatSettings();
    });
}

async function changeChatTitle() {
    const title = document.getElementById('settingsTitle').value.trim();
    if (!title || !activeChatId) return;
    await db.collection('chats').doc(activeChatId).update({ title });
    document.getElementById('chatTitle').textContent = title;
    closeModal('chatSettingsModal');
}

async function deleteChat() {
    showCustomConfirm('Delete entire chat for everyone?', async (confirmed) => {
        if (!confirmed) return;
        const msgs = await db.collection('chats').doc(activeChatId).collection('messages').get();
        for (const d of msgs.docs) await d.ref.delete();
        await db.collection('chats').doc(activeChatId).delete();
        activeChatId = null;
        document.getElementById('activeChat').style.display = 'none';
        document.getElementById('noChatSelected').style.display = 'flex';
        closeModal('chatSettingsModal');
    });
}

async function leaveChat() {
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