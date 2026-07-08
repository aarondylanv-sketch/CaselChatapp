// ============ PERMISSIONS SYSTEM ============
let currentPermMemberId = null;
let defaultPermissions = {
    sendMessages: true,
    changeTitle: true,
    kickMembers: false,
    viewCode: true
};

// Member colors array
const memberColors = [
    'var(--mem-1)', 'var(--mem-2)', 'var(--mem-3)', 'var(--mem-4)', 'var(--mem-5)',
    'var(--mem-6)', 'var(--mem-7)', 'var(--mem-8)', 'var(--mem-9)', 'var(--mem-10)',
    'var(--mem-11)', 'var(--mem-12)', 'var(--mem-13)', 'var(--mem-14)', 'var(--mem-15)',
    'var(--mem-16)', 'var(--mem-17)', 'var(--mem-18)', 'var(--mem-19)', 'var(--mem-20)'
];

function getMemberColor(index) {
    return memberColors[index % 20];
}

function getMemberColorHex(index) {
    const colors = [
        '#58a6ff', '#3fb950', '#d2991d', '#da3633', '#a371f7',
        '#79c0ff', '#56d364', '#e3b341', '#f85149', '#bf8700',
        '#7ee787', '#ff7b72', '#ffa657', '#db6d28', '#f778ba',
        '#c297ff', '#9ecbff', '#a5d6ff', '#d2a8ff', '#ffc2c2'
    ];
    return colors[index % 20];
}

async function openPermissions(memberId, memberName) {
    if (!activeChatId) return;
    
    const chatDoc = await db.collection('chats').doc(activeChatId).get();
    const chat = chatDoc.data();
    
    // Only owner can manage permissions
    if (chat.createdBy !== currentUser.uid) {
        showCustomAlert('Only the chat owner can manage permissions', '🔒');
        return;
    }
    
    currentPermMemberId = memberId;
    document.getElementById('permMemberName').textContent = `Permissions for: ${memberName}`;
    
    // Load current permissions
    const perms = chat.memberPermissions?.[memberId] || { ...defaultPermissions };
    
    document.getElementById('permSendMsg').checked = perms.sendMessages !== false;
    document.getElementById('permChangeTitle').checked = perms.changeTitle === true;
    document.getElementById('permKick').checked = perms.kickMembers === true;
    document.getElementById('permViewCode').checked = perms.viewCode !== false;
    
    document.getElementById('permissionsModal').style.display = 'flex';
}

async function savePermissions() {
    if (!activeChatId || !currentPermMemberId) return;
    
    const perms = {
        sendMessages: document.getElementById('permSendMsg').checked,
        changeTitle: document.getElementById('permChangeTitle').checked,
        kickMembers: document.getElementById('permKick').checked,
        viewCode: document.getElementById('permViewCode').checked
    };
    
    await db.collection('chats').doc(activeChatId).update({
        [`memberPermissions.${currentPermMemberId}`]: perms
    });
    
    closeModal('permissionsModal');
    showCustomAlert('Permissions updated!', '✅');
}

async function kickMemberFromPerms() {
    if (!currentPermMemberId) return;
    
    showCustomConfirm('Kick this member from the chat?', async (confirmed) => {
        if (!confirmed) return;
        
        await db.collection('chats').doc(activeChatId).update({
            members: firebase.firestore.FieldValue.arrayRemove(currentPermMemberId),
            kickedMembers: firebase.firestore.FieldValue.arrayUnion(currentPermMemberId)
        });
        
        closeModal('permissionsModal');
        openChatSettings();
        showCustomAlert('Member kicked!', '✅');
    });
}

async function updateDefaultPerms() {
    if (!activeChatId) return;
    
    const perms = {
        sendMessages: document.getElementById('defSendMsg').checked,
        changeTitle: document.getElementById('defChangeTitle').checked,
        kickMembers: document.getElementById('defKick').checked,
        viewCode: document.getElementById('defViewCode').checked
    };
    
    await db.collection('chats').doc(activeChatId).update({
        defaultPermissions: perms
    });
}

async function transferOwnership() {
    if (!activeChatId || !currentPermMemberId) return;
    
    // Generate 10-digit code
    const transferCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    document.getElementById('transferCodeDisp').textContent = transferCode;
    document.getElementById('transferCodeInput').value = '';
    document.getElementById('transferError').style.display = 'none';
    
    // Store the code temporarily
    window._transferCode = transferCode;
    window._transferToId = currentPermMemberId;
    
    closeModal('permissionsModal');
    document.getElementById('transferModal').style.display = 'flex';
}

async function confirmTransfer() {
    const input = document.getElementById('transferCodeInput').value.trim();
    const errorEl = document.getElementById('transferError');
    
    if (input !== window._transferCode) {
        errorEl.textContent = 'Invalid code. Transfer cancelled.';
        errorEl.style.display = 'block';
        return;
    }
    
    try {
        const chatDoc = await db.collection('chats').doc(activeChatId).get();
        const chat = chatDoc.data();
        const newOwnerId = window._transferToId;
        
        // Transfer ownership
        await db.collection('chats').doc(activeChatId).update({
            createdBy: newOwnerId,
            // Reset old owner's permissions to default
            [`memberPermissions.${currentUser.uid}`]: { ...defaultPermissions }
        });
        
        closeModal('transferModal');
        showCustomAlert('Ownership transferred! You are now a regular member.', '✅');
        
        // Clean up
        window._transferCode = null;
        window._transferToId = null;
        
        openChatSettings();
        
    } catch (error) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.style.display = 'block';
    }
}

// Check if user has permission
async function hasPermission(userId, permission) {
    if (!activeChatId) return false;
    
    const chatDoc = await db.collection('chats').doc(activeChatId).get();
    const chat = chatDoc.data();
    
    // Owner has all permissions
    if (chat.createdBy === userId) return true;
    
    // Check specific permissions
    const perms = chat.memberPermissions?.[userId] || chat.defaultPermissions || defaultPermissions;
    return perms[permission] !== false;
}

async function checkSendPermission() {
    if (!activeChatId || !currentUser) return true;
    const canSend = await hasPermission(currentUser.uid, 'sendMessages');
    if (!canSend) {
        showCustomAlert('You do not have permission to send messages in this chat', '🔒');
    }
    return canSend;
}