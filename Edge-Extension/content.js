chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "initiateCapture") {
    startCapture();
    sendResponse({ status: "Capture initiated" });
    return true; // Indicates an asynchronous response.
  }
});

async function startCapture() {
  console.log("Starting screen capture...");
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "motion" },
      audio: false,
    });

    // A track is a single media stream (e.g., video or audio).
    const track = stream.getVideoTracks()[0];

    // The ImageCapture API provides a way to grab a frame from a MediaStream track.
    const imageCapture = new ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();

    // Stop the track to end the screen sharing session and remove the browser's indicator.
    track.stop();

    // The bitmap needs to be drawn to a canvas to be converted to a data URL.
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);

    const dataUrl = canvas.toDataURL('image/png');

    // For now, log the data URL. Next, I will display this in a modal.
    console.log("Capture successful. Image Data URL ready.");

    // TODO: Create a modal and display the image.
    displayCaptureInModal(dataUrl);

  } catch (err) {
    // This error is common and expected if the user cancels the screen share prompt.
    if (err.name === 'NotAllowedError') {
      console.log('Screen capture permission denied by user.');
    } else {
      console.error("Error during screen capture:", err);
    }
  }
}

function displayCaptureInModal(dataUrl) {
  // Remove any existing overlay first.
  const existingOverlay = document.getElementById('text-grab-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create the overlay div
  const overlay = document.createElement('div');
  overlay.id = 'text-grab-overlay';

  // Create the container for the screenshot
  const container = document.createElement('div');
  container.id = 'text-grab-screenshot-container';

  // Create the image element
  const screenshotImg = document.createElement('img');
  screenshotImg.id = 'text-grab-screenshot';
  screenshotImg.src = dataUrl;

  // Create the toolbar
  const toolbar = document.createElement('div');
  toolbar.id = 'text-grab-toolbar';

  // Language selection
  const langSelect = document.createElement('select');
  langSelect.id = 'text-grab-lang-select';
  const engOption = document.createElement('option');
  engOption.value = 'eng';
  engOption.textContent = 'English';
  langSelect.appendChild(engOption);
  toolbar.appendChild(langSelect);

  // Mode buttons
  const normalModeBtn = document.createElement('button');
  normalModeBtn.className = 'text-grab-mode-btn active';
  normalModeBtn.dataset.mode = 'Normal';
  normalModeBtn.innerHTML = '<i class="ms-Icon ms-Icon--TextDocument"></i>';
  toolbar.appendChild(normalModeBtn);

  const singleLineBtn = document.createElement('button');
  singleLineBtn.className = 'text-grab-mode-btn';
  singleLineBtn.dataset.mode = 'Single Line';
  singleLineBtn.innerHTML = '<i class="ms-Icon ms-Icon--Add"></i>'; // Placeholder, replace with better icon
  toolbar.appendChild(singleLineBtn);

  const tableBtn = document.createElement('button');
  tableBtn.className = 'text-grab-mode-btn';
  tableBtn.dataset.mode = 'Table';
  tableBtn.innerHTML = '<i class="ms-Icon ms-Icon--Table"></i>';
  toolbar.appendChild(tableBtn);

  const grabFrameBtn = document.createElement('button');
  grabFrameBtn.className = 'text-grab-mode-btn';
  grabFrameBtn.dataset.mode = 'Grab Frame';
  grabFrameBtn.innerHTML = '<i class="ms-Icon ms-Icon--Camera"></i>'; // Placeholder
  toolbar.appendChild(grabFrameBtn);

  // Post-capture actions dropdown
  const actionsDropdown = document.createElement('div');
  actionsDropdown.className = 'text-grab-dropdown';
  const actionsButton = document.createElement('button');
  actionsButton.textContent = 'Actions ▼';
  actionsDropdown.appendChild(actionsButton);
  const actionsMenu = document.createElement('div');
  actionsMenu.className = 'text-grab-dropdown-content';
  actionsMenu.innerHTML = `
    <a href="#" data-action="trim">Trim Each Line</a>
    <a href="#" data-action="guid">Fix GUIDs</a>
    <a href="#" data-action="single-line">Make Single Line</a>
  `;
  actionsDropdown.appendChild(actionsMenu);
  toolbar.appendChild(actionsDropdown);

  // Close button for the toolbar
  const toolbarCloseButton = document.createElement('button');
  toolbarCloseButton.id = 'text-grab-toolbar-close';
  toolbarCloseButton.innerHTML = '&times;'; // A simple 'x' for now
  toolbarCloseButton.onclick = () => {
    overlay.remove();
  };
  toolbar.appendChild(toolbarCloseButton);

  // Assemble the modal
  overlay.appendChild(toolbar);
  container.appendChild(screenshotImg);
  overlay.appendChild(container);

  // Add the modal to the page
  document.body.appendChild(overlay);

  // Create the output panel (initially hidden)
  const outputPanel = document.createElement('div');
  outputPanel.id = 'text-grab-output-panel';
  outputPanel.style.display = 'none'; // Hide it by default
  outputPanel.innerHTML = `
    <textarea id="text-grab-output-textarea"></textarea>
    <button id="text-grab-copy-button">Copy</button>
  `;
  overlay.appendChild(outputPanel);

  console.log("Screenshot is now displayed in a modal.");

  // --- Toolbar Logic ---
  const modeButtons = document.querySelectorAll('.text-grab-mode-btn');
  let currentOcrMode = 'Normal'; // Default mode

  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentOcrMode = button.dataset.mode;
      console.log(`OCR Mode changed to: ${currentOcrMode}`);
    });
  });

  const actionsMenu = document.querySelector('.text-grab-dropdown-content');
  actionsMenu.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      const action = e.target.dataset.action;
      applyTextAction(action);
    }
  });

  // --- Region Selection Logic ---
  const selectionBox = document.createElement('div');
  selectionBox.id = 'text-grab-selection-box';

  let isSelecting = false;
  let startX, startY;

  container.addEventListener('mousedown', (e) => {
    isSelecting = true;
    // Get coordinates relative to the container
    startX = e.clientX - container.offsetLeft;
    startY = e.clientY - container.offsetTop;

    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';

    container.appendChild(selectionBox);
  });

  container.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX - container.offsetLeft;
    const currentY = e.clientY - container.offsetTop;

    const width = currentX - startX;
    const height = currentY - startY;

    // Handle drawing in all directions
    selectionBox.style.left = `${width > 0 ? startX : currentX}px`;
    selectionBox.style.top = `${height > 0 ? startY : currentY}px`;
    selectionBox.style.width = `${Math.abs(width)}px`;
    selectionBox.style.height = `${Math.abs(height)}px`;
  });

  container.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;

    isSelecting = false;
    const finalRect = {
      left: parseInt(selectionBox.style.left, 10),
      top: parseInt(selectionBox.style.top, 10),
      width: parseInt(selectionBox.style.width, 10),
      height: parseInt(selectionBox.style.height, 10)
    };

    console.log("Selection complete:", finalRect);

    // Don't try to OCR a tiny selection
    if (finalRect.width < 5 || finalRect.height < 5) {
      selectionBox.remove();
      return;
    }

    if (currentOcrMode === 'Grab Frame') {
      createGrabFrame(finalRect);
      // Close the main OCR modal
      document.getElementById('text-grab-overlay').remove();
    } else {
      performOCR(screenshotImg, finalRect, currentOcrMode);
      // Give some visual feedback
      selectionBox.style.borderColor = '#32cd32'; // Green border
    }
    selectionBox.textContent = 'Processing...';
    selectionBox.style.color = 'white';
    selectionBox.style.textAlign = 'center';
  });
}

async function performOCR(imageElement, rect, mode) {
  const worker = await Tesseract.createWorker({
    workerPath: chrome.runtime.getURL('lib/tesseract/worker.min.js'),
    corePath: chrome.runtime.getURL('lib/tesseract-core/'),
    langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast/',
    logger: m => console.log(m), // Log Tesseract's progress
  });

  try {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Crop the image to the selected rectangle using a canvas
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');

    // Calculate the source coordinates based on the image's actual dimensions
    const naturalWidth = imageElement.naturalWidth;
    const naturalHeight = imageElement.naturalHeight;
    const displayedWidth = imageElement.width;
    const displayedHeight = imageElement.height;

    const sx = (rect.left / displayedWidth) * naturalWidth;
    const sy = (rect.top / displayedHeight) * naturalHeight;
    const sWidth = (rect.width / displayedWidth) * naturalWidth;
    const sHeight = (rect.height / displayedHeight) * naturalHeight;

    // The container's offset needs to be accounted for in the source rect
    const container = document.getElementById('text-grab-screenshot-container');
    const containerRect = container.getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();

    const sourceX = sx + ((imageRect.left - containerRect.left) / displayedWidth) * naturalWidth;
    const sourceY = sy + ((imageRect.top - containerRect.top) / displayedHeight) * naturalHeight;

    ctx.drawImage(imageElement, sourceX, sourceY, sWidth, sHeight, 0, 0, rect.width, rect.height);

    let { data: { text } } = await worker.recognize(canvas);
    console.log('Recognized Text (raw):', text);

    if (mode === 'Single Line') {
      text = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();
    }
    // Table mode will be handled later, for now it acts like Normal.

    // --- Output Panel Logic ---
    const outputPanel = document.getElementById('text-grab-output-panel');
    const outputTextarea = document.getElementById('text-grab-output-textarea');
    const copyButton = document.getElementById('text-grab-copy-button');

    outputTextarea.value = text;
    outputPanel.style.display = 'flex';

    copyButton.onclick = () => {
      navigator.clipboard.writeText(outputTextarea.value);
      copyButton.textContent = 'Copied!';
      setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
    };

    // Hide the main overlay and selection box, showing only the output panel
    const screenshotContainer = document.getElementById('text-grab-screenshot-container');
    const toolbar = document.getElementById('text-grab-toolbar');
    screenshotContainer.style.visibility = 'hidden';
    toolbar.style.visibility = 'hidden';

  } catch (err) {
    console.error('OCR Error:', err);
    alert('An error occurred during OCR.');
  } finally {
    await worker.terminate();
    // Do not remove the overlay here, as the output panel is now visible.
    // The user will close it via the toolbar's close button.
  }
}

function applyTextAction(action) {
  const textarea = document.getElementById('text-grab-output-textarea');
  let text = textarea.value;

  switch (action) {
    case 'trim':
      text = text.split('\n').map(line => line.trim()).join('\n');
      break;
    case 'single-line':
      text = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();
      break;
    case 'guid':
      const guidCorrections = {
        'o': '0', 'O': '0', 'i': '1', 'l': '1', 'I': '1',
        'h': '4', 'z': '2', 'Z': '2', 'g': '9', 'G': '9',
        's': '5', 'S': '5', 'Ø': '0', '#': 'f', '@': '0',
        'Q': '0', '¥': 'f', '£': 'f', '/': '7'
      };
      text = text.replace(/\s/g, '') // Remove spaces
                 .replace(/-\r?\n/g, '-') // Join hyphenated lines
                 .replace(/\r?\n-/g, '-');
      text = text.split('').map(char => guidCorrections[char] || char).join('');
      break;
  }
  textarea.value = text;
}

async function captureFrameRegion(frame) {
  // Get the position and size of the frame
  const rect = frame.getBoundingClientRect();

  chrome.runtime.sendMessage({ action: "captureVisibleTab" }, (response) => {
    if (response.error) {
      console.error("Failed to capture tab:", response.error);
      alert("Failed to capture tab. Please try again.");
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Use device pixel ratio for sharper captures on high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');

      // The screenshot is of the viewport, so we can use the frame's rect directly.
      // We need to account for the device pixel ratio in the source image.
      ctx.drawImage(
        img,
        rect.left * dpr,
        rect.top * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0, 0,
        canvas.width,
        canvas.height
      );

      // Since the main modal is gone, we need to re-create the output panel
      // or make it persistent. For now, let's just use the OCR function
      // which will create a new modal with the results.
      // A better approach would be a single, reusable output modal.
      performOCR(canvas, {width: canvas.width, height: canvas.height}, 'Normal');
    };
    img.src = response.dataUrl;
  });
}

function createGrabFrame(rect) {
  // Remove existing frame if any
  const existingFrame = document.getElementById('text-grab-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const frame = document.createElement('div');
  frame.id = 'text-grab-frame';
  frame.style.left = `${rect.left}px`;
  frame.style.top = `${rect.top}px`;
  frame.style.width = `${rect.width}px`;
  frame.style.height = `${rect.height}px`;

  const toolbar = document.createElement('div');
  toolbar.id = 'text-grab-frame-toolbar';

  const captureBtn = document.createElement('button');
  captureBtn.className = 'text-grab-frame-btn';
  captureBtn.textContent = 'Capture';
  captureBtn.onclick = () => captureFrameRegion(frame);
  toolbar.appendChild(captureBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-grab-frame-btn';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => frame.remove();
  toolbar.appendChild(closeBtn);

  frame.appendChild(toolbar);

  // Add resize handles
  ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    frame.appendChild(handle);
  });

  document.body.appendChild(frame);

  // --- Drag and Resize Logic for the Frame ---
  let isDragging = false;
  let isResizing = false;
  let currentResizeHandle = null;
  let startX, startY, startLeft, startTop, startWidth, startHeight;

  frame.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle')) {
      isResizing = true;
      currentResizeHandle = e.target;
    } else if (e.target.closest('#text-grab-frame-toolbar') === null) {
      isDragging = true;
    } else {
      return;
    }

    startX = e.clientX;
    startY = e.clientY;
    startLeft = frame.offsetLeft;
    startTop = frame.offsetTop;
    startWidth = frame.offsetWidth;
    startHeight = frame.offsetHeight;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      frame.style.left = `${startLeft + dx}px`;
      frame.style.top = `${startTop + dy}px`;
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (currentResizeHandle.classList.contains('bottom-right')) {
        frame.style.width = `${startWidth + dx}px`;
        frame.style.height = `${startHeight + dy}px`;
      } else if (currentResizeHandle.classList.contains('bottom-left')) {
        frame.style.width = `${startWidth - dx}px`;
        frame.style.height = `${startHeight + dy}px`;
        frame.style.left = `${startLeft + dx}px`;
      } else if (currentResizeHandle.classList.contains('top-right')) {
        frame.style.width = `${startWidth + dx}px`;
        frame.style.height = `${startHeight - dy}px`;
        frame.style.top = `${startTop + dy}px`;
      } else if (currentResizeHandle.classList.contains('top-left')) {
        frame.style.width = `${startWidth - dx}px`;
        frame.style.height = `${startHeight - dy}px`;
        frame.style.left = `${startLeft + dx}px`;
        frame.style.top = `${startTop + dy}px`;
      }
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
  });
}

console.log("Text Grab content script loaded and ready.");