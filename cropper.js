// ============ IMAGE CROPPER ============
let cropImage = null;
let cropFile = null;
let cropScale = 1;
let cropX = 0;
let cropY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imgStartX = 0;
let imgStartY = 0;

function cropProfilePic(event) {
    const file = event.target.files[0];
    if (!file) return;

    cropFile = file;
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = document.getElementById('cropImage');
        img.src = e.target.result;
        img.onload = function() {
            resetCropPosition();
            document.getElementById('cropModal').style.display = 'flex';
            setupCropEvents();
        };
    };
    
    reader.readAsDataURL(file);
}

function resetCropPosition() {
    cropScale = 1;
    cropX = 0;
    cropY = 0;
    updateCropTransform();
}

function updateCropTransform() {
    const img = document.getElementById('cropImage');
    img.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropScale})`;
}

function setupCropEvents() {
    const container = document.querySelector('.crop-container');
    const img = document.getElementById('cropImage');

    // Mouse events
    img.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);

    // Touch events
    img.addEventListener('touchstart', startDragTouch, { passive: false });
    document.addEventListener('touchmove', dragTouch, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // Wheel zoom
    container.addEventListener('wheel', zoomCrop, { passive: false });
}

function startDrag(e) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    imgStartX = cropX;
    imgStartY = cropY;
    e.preventDefault();
}

function startDragTouch(e) {
    if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        imgStartX = cropX;
        imgStartY = cropY;
    }
    e.preventDefault();
}

function drag(e) {
    if (!isDragging) return;
    cropX = imgStartX + (e.clientX - dragStartX);
    cropY = imgStartY + (e.clientY - dragStartY);
    updateCropTransform();
}

function dragTouch(e) {
    if (!isDragging || e.touches.length !== 1) return;
    cropX = imgStartX + (e.touches[0].clientX - dragStartX);
    cropY = imgStartY + (e.touches[0].clientY - dragStartY);
    updateCropTransform();
    e.preventDefault();
}

function stopDrag() {
    isDragging = false;
}

function zoomCrop(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    cropScale = Math.max(0.5, Math.min(3, cropScale + delta));
    updateCropTransform();
}

function cancelCrop() {
    document.getElementById('cropModal').style.display = 'none';
    document.getElementById('picUpload').value = '';
    cropFile = null;
    
    // Remove event listeners
    const img = document.getElementById('cropImage');
    img.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    img.removeEventListener('touchstart', startDragTouch);
    document.removeEventListener('touchmove', dragTouch);
    document.removeEventListener('touchend', stopDrag);
}

async function saveCrop() {
    if (!cropFile || !currentUser) return;

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = document.getElementById('cropImage');
        
        // Calculate crop area (center circle)
        const container = document.querySelector('.crop-container');
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const cropSize = 250;
        const cropCenterX = containerWidth / 2;
        const cropCenterY = containerHeight / 2;
        
        // Set canvas size to crop size
        canvas.width = cropSize;
        canvas.height = cropSize;
        
        // Calculate source position
        const srcX = (cropCenterX - cropSize / 2 - cropX) / cropScale;
        const srcY = (cropCenterY - cropSize / 2 - cropY) / cropScale;
        const srcW = cropSize / cropScale;
        const srcH = cropSize / cropScale;
        
        // Draw cropped image
        ctx.beginPath();
        ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropSize, cropSize);
        
        // Convert to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        
        // Upload to Firebase Storage
        const storageRef = storage.ref(`profilePics/${currentUser.uid}`);
        await storageRef.put(blob);
        const downloadURL = await storageRef.getDownloadURL();
        
        // Update user profile
        await db.collection('users').doc(currentUser.uid).update({
            profilePic: downloadURL
        });
        
        userProfile.profilePic = downloadURL;
        updateProfilePicDisplay();
        
        document.getElementById('cropModal').style.display = 'none';
        document.getElementById('picUpload').value = '';
        cropFile = null;
        
        showCustomAlert('Profile picture updated!', '✅');
        
    } catch (error) {
        showCustomAlert('Error uploading photo: ' + error.message, '❌');
    }
}

function updateProfilePicDisplay() {
    const textEl = document.getElementById('profilePicText');
    const imgEl = document.getElementById('profilePicImg');
    
    if (userProfile.profilePic) {
        textEl.style.display = 'none';
        imgEl.style.display = 'block';
        imgEl.src = userProfile.profilePic;
    } else {
        textEl.style.display = 'block';
        imgEl.style.display = 'none';
    }
}