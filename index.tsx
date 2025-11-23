/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {GoogleGenAI} from '@google/genai';

// Fix: Define and use AIStudio interface for window.aistudio to resolve type conflict.
// Define the aistudio property on the window object for TypeScript
declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

async function openApiKeyDialog() {
  if (window.aistudio?.openSelectKey) {
    await window.aistudio.openSelectKey();
  } else {
    // This provides a fallback for environments where the dialog isn't available
    showStatusError(
      'API key selection is not available. Please configure the API_KEY environment variable.',
    );
  }
}

const statusEl = document.querySelector('#status') as HTMLDivElement;

async function generateImage(
  prompt: string,
  apiKey: string,
  size: '1K' | '2K' | '4K',
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
) {
  const ai = new GoogleGenAI({apiKey});

  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt,
    config: {
      imageSize: size,
      aspectRatio: aspectRatio,
      // numberOfImages: 1,
      // outputMimeType: 'image/jpeg',
      // personGeneration: 'ALLOW_ADULT',
    },
  });

  const images = response.generatedImages;
  if (images === undefined || images.length === 0) {
    throw new Error(
      'No images were generated. The prompt may have been blocked.',
    );
  }

  const base64ImageBytes = images[0].image.imageBytes;
  const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
  outputImage.src = imageUrl;
  outputImage.style.display = 'block';
  downloadButton.style.display = 'block'; // Show download button
  downloadLink = imageUrl; // Store image URL for download
}

// --- DOM Element Selection ---
const promptEl = document.querySelector('#prompt-input') as HTMLTextAreaElement;
const imageSizeSelectEl = document.querySelector(
  '#image-size-select',
) as HTMLSelectElement;
const aspectRatioSelectEl = document.querySelector(
  '#aspect-ratio-select',
) as HTMLSelectElement;
const generateButton = document.querySelector(
  '#generate-button',
) as HTMLButtonElement;
const outputImage = document.querySelector('#output-image') as HTMLImageElement;
const downloadButton = document.querySelector('#download-button') as HTMLButtonElement;
const historyContainerEl = document.querySelector('#image-history-container') as HTMLDivElement;
const clearHistoryButton = document.querySelector('#clear-history-button') as HTMLButtonElement;
const imageHistorySection = document.querySelector('#image-history-section') as HTMLDivElement;
const loadingSpinner = document.querySelector('#loading-spinner') as HTMLDivElement;

const apiKeySectionEl = document.querySelector('#api-key-section') as HTMLDivElement;
const apiKeyInputEl = document.querySelector('#api-key-input') as HTMLInputElement;
const useCustomApiKeyCheckbox = document.querySelector('#use-custom-api-key') as HTMLInputElement;

// --- State Variables ---
let prompt = '';
let imageSize: '1K' | '2K' | '4K' = '1K'; // Default image size
let aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '1:1'; // Default aspect ratio
let downloadLink: string | null = null; // Stores the URL of the generated image for download

const IMAGE_HISTORY_KEY = 'imagen_image_history';
let imageHistory: { url: string; prompt: string; timestamp: number }[] = [];

const CUSTOM_API_KEY_STORAGE_KEY = 'imagen_custom_api_key';
const USE_CUSTOM_KEY_STORAGE_KEY = 'imagen_use_custom_api_key';
let userApiKey: string = '';
let useCustomApiKey: boolean = false;


// --- History Management ---
function loadHistory(): void {
  try {
    const storedHistory = localStorage.getItem(IMAGE_HISTORY_KEY);
    if (storedHistory) {
      imageHistory = JSON.parse(storedHistory);
    }
  } catch (e) {
    console.error('Failed to load image history from local storage:', e);
    imageHistory = [];
  }
}

function saveHistory(): void {
  try {
    localStorage.setItem(IMAGE_HISTORY_KEY, JSON.stringify(imageHistory));
  } catch (e) {
    console.error('Failed to save image history to local storage:', e);
  }
}

function addImageToHistory(url: string, prompt: string): void {
  imageHistory.push({ url, prompt, timestamp: Date.now() });
  saveHistory();
  renderImageHistory();
}

function clearImageHistory(): void {
  imageHistory = [];
  saveHistory();
  renderImageHistory();
}

function renderImageHistory(): void {
  historyContainerEl.innerHTML = ''; // Clear existing history
  if (imageHistory.length === 0) {
    imageHistorySection.style.display = 'none';
    return;
  }

  imageHistorySection.style.display = 'block'; // Show history section
  
  // Render in reverse chronological order
  for (let i = imageHistory.length - 1; i >= 0; i--) {
    const item = imageHistory[i];
    const historyItemEl = document.createElement('div');
    historyItemEl.className = 'bg-[#353739] p-3 rounded-lg flex items-center space-x-4 mb-2'; // Tailwind classes

    const imgEl = document.createElement('img');
    imgEl.src = item.url;
    imgEl.alt = item.prompt;
    imgEl.className = 'w-20 h-20 object-cover rounded-md flex-shrink-0'; // Thumbnail size
    imgEl.loading = 'lazy';

    const textContentEl = document.createElement('div');
    textContentEl.className = 'flex-grow';

    const promptEl = document.createElement('p');
    promptEl.className = 'text-sm text-gray-300 line-clamp-2';
    promptEl.innerText = item.prompt;

    const downloadHistoryButton = document.createElement('button');
    downloadHistoryButton.className = 'bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex-shrink-0';
    downloadHistoryButton.innerText = 'Download';
    downloadHistoryButton.addEventListener('click', () => handleDownload(item.url, `generated-image-${item.timestamp}.jpeg`));

    textContentEl.appendChild(promptEl);
    historyItemEl.appendChild(imgEl);
    historyItemEl.appendChild(textContentEl);
    historyItemEl.appendChild(downloadHistoryButton);
    historyContainerEl.appendChild(historyItemEl);
  }
}

// --- Custom API Key Management ---
function loadCustomApiKeySettings(): void {
  try {
    const storedCustomKey = localStorage.getItem(CUSTOM_API_KEY_STORAGE_KEY);
    if (storedCustomKey) {
      userApiKey = storedCustomKey;
      apiKeyInputEl.value = userApiKey;
    }
    const storedUseCustomKey = localStorage.getItem(USE_CUSTOM_KEY_STORAGE_KEY);
    if (storedUseCustomKey !== null) {
      useCustomApiKey = JSON.parse(storedUseCustomKey);
      useCustomApiKeyCheckbox.checked = useCustomApiKey;
      apiKeyInputEl.disabled = !useCustomApiKey;
    } else {
      // Default behavior if not set: custom key input is disabled
      apiKeyInputEl.disabled = true;
    }
  } catch (e) {
    console.error('Failed to load custom API key settings from local storage:', e);
    userApiKey = '';
    useCustomApiKey = false;
    apiKeyInputEl.value = '';
    useCustomApiKeyCheckbox.checked = false;
    apiKeyInputEl.disabled = true;
  }
}

function saveCustomApiKeySettings(): void {
  try {
    localStorage.setItem(CUSTOM_API_KEY_STORAGE_KEY, userApiKey);
    localStorage.setItem(USE_CUSTOM_KEY_STORAGE_KEY, JSON.stringify(useCustomApiKey));
  } catch (e) {
    console.error('Failed to save custom API key settings to local storage:', e);
  }
}


// --- Event Listeners ---
promptEl.addEventListener('input', () => {
  prompt = promptEl.value;
});

imageSizeSelectEl.addEventListener('change', () => {
  imageSize = imageSizeSelectEl.value as '1K' | '2K' | '4K';
});

aspectRatioSelectEl.addEventListener('change', () => {
  aspectRatio = aspectRatioSelectEl.value as '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
});

generateButton.addEventListener('click', () => {
  if (!prompt.trim()) {
    showStatusError('Please enter a prompt to generate an image.');
    return;
  }
  generate();
});

downloadButton.addEventListener('click', () => {
  if (downloadLink) {
    handleDownload(downloadLink);
  } else {
    showStatusError('No image available for download.');
  }
});

clearHistoryButton.addEventListener('click', () => {
  clearImageHistory();
  showStatusError('Image history cleared.');
});

apiKeyInputEl.addEventListener('input', () => {
  userApiKey = apiKeyInputEl.value;
  saveCustomApiKeySettings();
  apiKeyInputEl.classList.remove('border-red-500', 'ring-red-500'); // Clear highlighting on input
});

useCustomApiKeyCheckbox.addEventListener('change', () => {
  useCustomApiKey = useCustomApiKeyCheckbox.checked;
  apiKeyInputEl.disabled = !useCustomApiKey; // Enable/disable input based on checkbox
  saveCustomApiKeySettings();
  apiKeyInputEl.classList.remove('border-red-500', 'ring-red-500'); // Clear highlighting
});

// --- Functions ---
function showStatusError(message: string) {
  statusEl.innerHTML = `<span class="text-red-400">${message}</span>`;
}

function setControlsDisabled(disabled: boolean) {
  generateButton.disabled = disabled;
  promptEl.disabled = disabled;
  imageSizeSelectEl.disabled = disabled;
  aspectRatioSelectEl.disabled = disabled;
  downloadButton.disabled = disabled; // Disable download button during generation
  clearHistoryButton.disabled = disabled; // Disable clear history button
  useCustomApiKeyCheckbox.disabled = disabled; // Disable checkbox during generation
  apiKeyInputEl.disabled = disabled || !useCustomApiKey; // Disable input if generation or not using custom key

  if (disabled) {
    loadingSpinner.style.display = 'block';
  } else {
    loadingSpinner.style.display = 'none';
  }
}

function handleDownload(url: string, filename: string = 'generated-image.jpeg') {
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; // Suggest a filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    showStatusError('No image available for download.');
  }
}

async function generate() {
  let activeApiKey: string | undefined = undefined;
  let isUsingCustomKey = false;

  if (useCustomApiKey && userApiKey.trim()) {
    activeApiKey = userApiKey.trim();
    isUsingCustomKey = true;
  } else {
    // Fallback to environment variable if custom key is not used or empty
    activeApiKey = process.env.API_KEY;
  }

  if (!activeApiKey) {
    showStatusError(
      'No API key configured. Please enter your API key or use the "Add your API Key" button.'
    );
    // Only open the dialog if we were *expecting* an environment key but didn't get one.
    // If the user checked "use custom key" but left it blank, they need to fill the input.
    if (!isUsingCustomKey) {
      await openApiKeyDialog();
    } else {
      apiKeyInputEl.focus();
      apiKeyInputEl.classList.add('border-red-500', 'ring-red-500'); // Highlight input
    }
    return;
  } else {
    // Clear any highlighting if an API key is now present
    apiKeyInputEl.classList.remove('border-red-500', 'ring-red-500');
  }

  statusEl.innerText = 'Generating image...';
  outputImage.style.display = 'none';
  downloadButton.style.display = 'none'; // Hide download button while generating
  downloadLink = null; // Reset download link
  setControlsDisabled(true);

  try {
    await generateImage(prompt, activeApiKey, imageSize, aspectRatio);
    // Note: addImageToHistory is now called inside generateImage after successful generation
    statusEl.innerText = 'Image generated successfully.';
  } catch (e) {
    console.error('Image generation failed:', e);
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';

    let userFriendlyMessage = `Error: ${errorMessage}`;
    let shouldOpenDialog = false;

    if (typeof errorMessage === 'string') {
      if (errorMessage.includes('You exceeded your current quota')) {
        userFriendlyMessage =
          'Quota exceeded. Please check your billing details on Google AI Studio.';
        shouldOpenDialog = true; // Suggest opening dialog to check/select key
      } else if (errorMessage.includes('Requested entity was not found.')) {
        userFriendlyMessage =
          'Model not found. This can be caused by an invalid API key or permission issues. Please check your API key.';
        shouldOpenDialog = true;
      } else if (
        errorMessage.includes('API_KEY_INVALID') ||
        errorMessage.includes('API key not valid') ||
        errorMessage.toLowerCase().includes('permission denied')
      ) {
        if (isUsingCustomKey) {
          userFriendlyMessage =
            'The custom API key you provided is invalid or lacks necessary permissions. Please check the key in the input field.';
        } else {
          userFriendlyMessage =
            'The API key managed by AI Studio is invalid or lacks necessary permissions. Please use the "Add your API Key" button to select a valid key.';
        }
        shouldOpenDialog = true;
      }
    }

    showStatusError(userFriendlyMessage);

    // Only offer to open AI Studio dialog if the error *might* be resolved by picking a different *AI Studio* key,
    // or if we were originally using the environment key.
    if (shouldOpenDialog && !isUsingCustomKey) {
      await openApiKeyDialog();
    } else if (isUsingCustomKey) {
      // If using custom key and it failed, highlight input
      apiKeyInputEl.focus();
      apiKeyInputEl.classList.add('border-red-500', 'ring-red-500');
    }
  } finally {
    setControlsDisabled(false);
  }
}

// --- Initialize on load ---
loadHistory();
renderImageHistory();
loadCustomApiKeySettings();