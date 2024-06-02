// Firebase-Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyBUxod-6V4LPWMkcBs0tSc8euATu2FeSGk",
    authDomain: "up-and-down-loade-site.firebaseapp.com",
    projectId: "up-and-down-loade-site",
    storageBucket: "up-and-down-loade-site.appspot.com",
    messagingSenderId: "296367483129",
    appId: "1:296367483129:web:b324b2809f2d0263525a28",
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);

const storage = firebase.storage();
const db = firebase.firestore();

const MAX_CONCURRENT_UPLOADS = 3;  // Maximale Anzahl gleichzeitiger Uploads
let currentUploads = 0;  // Aktuelle Anzahl laufender Uploads

let uploadType = "";

// Umschalten zwischen Datei- und Ordner-Upload
function toggleSwitch() {
    const switchBody = document.getElementById("switch");
    const fileInput = document.getElementById("fileInput");
    const folderInput = document.getElementById("folderInput");

    if (switchBody.style.marginLeft === "2px") {
        folderInput.style.display = 'none';
        fileInput.style.display = 'block';
        switchBody.style.marginLeft = "130px";
        uploadType = "file";
    } else {
        fileInput.style.display = 'none';
        folderInput.style.display = 'block';
        switchBody.style.marginLeft = "2px";
        uploadType = "folder";
    }
}

// Eventlistener für Datei- und Ordnerauswahl
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('folderInput').addEventListener('change', handleFileSelect);

// Handhabung der Dateiauswahl
function handleFileSelect(event) {
    const files = event.target.files;
    const uploadingFilesContainer = document.getElementById('uploading-files-container');

    // Entferne vorhandene Dateicontainer, aber nicht die Überschrift
    uploadingFilesContainer.querySelectorAll('.file-container').forEach(container => container.remove());

    for (const file of files) {
        createFileContainer(file.name);
    }
}

// Eventlistener für das Formular
document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const files = uploadType === 'file' ? document.getElementById('fileInput').files : document.getElementById('folderInput').files;

    if (uploadType === 'folder') {
        await handleFolderUpload(files);
    } else {
        await handleFileUploads(files);
    }
});

// Handhabung des Ordneruploads
async function handleFolderUpload(files) {
    const zip = new JSZip();
    const firstFilePath = files[0].webkitRelativePath || files[0].name;
    const folderName = firstFilePath.split('/')[0];

    for (const file of files) {
        const filePath = file.webkitRelativePath || file.name;
        zip.file(filePath, file);
    }

    await waitForUploadSlot();
    currentUploads++;
    zip.generateAsync({ type: 'blob' }).then(async (content) => {
        const zipFile = new File([content], `${folderName}.zip`, { type: 'application/zip' });
        await uploadFile(zipFile);
    }).catch(console.error).finally(() => currentUploads--);
}

// Handhabung der Datei-Uploads
async function handleFileUploads(files) {
    for (const file of files) {
        await waitForUploadSlot();
        currentUploads++;
        await uploadFile(file);
        currentUploads--;
    }
}

// Warte, bis ein Upload-Slot frei ist
async function waitForUploadSlot() {
    while (currentUploads >= MAX_CONCURRENT_UPLOADS) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms warten
    }
}

// Datei hochladen
async function uploadFile(file) {
    try {
        const storageRef = storage.ref('uploads/' + file.name);
        const uploadTask = storageRef.put(file);

        const progressBarContainer = createProgressBarContainer(uploadTask);
        document.getElementById('progressContainer').appendChild(progressBarContainer.container);

        uploadTask.on('state_changed', 
            (snapshot) => updateProgress(snapshot, progressBarContainer.progress),
            (error) => console.error('Fehler beim Hochladen der Datei:', error),
            async () => await finalizeUpload(file, storageRef, progressBarContainer.container)
        );
    } catch (error) {
        console.error('Fehler beim Hochladen der Datei:', error);
        alert(`Fehler beim Hochladen der Datei ${file.name}. Überprüfen Sie die Konsole für weitere Details.`);
    }
}

// Fortschrittsbalken erstellen
function createProgressBarContainer(uploadTask) {
    const container = document.createElement('div');
    container.classList.add('progress-bar-container');
    const progress = document.createElement('div');
    progress.classList.add('progress');
    const cancelButton = document.createElement('button');
    cancelButton.classList.add('cancel-button');
    cancelButton.textContent = 'Abbrechen';

    container.appendChild(progress);
    container.appendChild(cancelButton);

    cancelButton.addEventListener('click', () => {
        uploadTask.cancel();
        container.remove();
    });

    return { container, progress };
}

// Fortschrittsanzeige aktualisieren
function updateProgress(snapshot, progress) {
    const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
    progress.style.width = progressValue + '%';
    progress.textContent = Math.floor(progressValue) + '%';
}

// Upload abschließen
async function finalizeUpload(file, storageRef, progressBarContainer) {
    const downloadURL = await storageRef.getDownloadURL();
    await db.collection('files').add({
        name: file.name,
        url: downloadURL,
        size: file.size
    });

    showUploadSuccessMessage(file.name);
    loadFiles();
    progressBarContainer.remove();
}

// Erfolgsmeldung anzeigen
function showUploadSuccessMessage(fileName) {
    const uploadeConfirmMessage = document.getElementById("confirme-message-container");
    const confirmeMessage = document.getElementById("confirme-message");
    confirmeMessage.innerHTML = `${fileName} erfolgreich hochgeladen`;
    uploadeConfirmMessage.style.marginTop = "-48%";
    setTimeout(() => {
        uploadeConfirmMessage.style.marginTop = "-100%";
    }, 2000);
}

// Datei-Container erstellen
function createFileContainer(fileName) {
    const fileContainer = document.createElement('div');
    fileContainer.classList.add('file-container');
    
    const fileNameParagraph = document.createElement('p');
    fileNameParagraph.classList.add('fileName');
    fileNameParagraph.textContent = fileName;
    
    const removeButton = document.createElement('button');
    removeButton.classList.add('uploade-file-remove-button');
    removeButton.addEventListener('click', () => fileContainer.remove());
    
    fileContainer.appendChild(fileNameParagraph);
    fileContainer.appendChild(removeButton);
    document.getElementById('uploading-files-container').appendChild(fileContainer);
}

// Dateien laden und anzeigen
async function loadFiles() {
    try {
        const snapshot = await db.collection('files').get();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = ''; // Vorherige Liste löschen

        snapshot.forEach(doc => {
            const file = doc.data();
            const listItem = createFileListItem(file);
            fileList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Fehler beim Laden der Dateien:', error);
        alert('Fehler beim Laden der Dateien. Überprüfen Sie die Konsole für weitere Details.');
    }
}

// Dateigröße formatieren
function formatFileSize(bytes) {
    if (bytes === undefined || bytes === null) return 'Unbekannt';
    if (bytes < 1024) return bytes + ' B';
    let k = 1024,
        sizes = ['KB', 'MB', 'GB', 'TB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i - 1];
}

// Dateilistelement erstellen
function createFileListItem(file) {
    const listItem = document.createElement('tr');

    // Name
    const fileNameCell = document.createElement('td');
    const fileNameText = document.createElement('p');
    fileNameText.textContent = file.name;
    fileNameCell.appendChild(fileNameText);
    listItem.appendChild(fileNameCell);

    // Größe
    const fileSizeCell = document.createElement('td');
    fileSizeCell.textContent = formatFileSize(file.size);
    listItem.appendChild(fileSizeCell);

    // Download-Button
    const downloadButtonCell = document.createElement('td');
    const downloadButton = document.createElement('button');
    downloadButton.classList.add('downloade-button');
    downloadButton.textContent = 'Download';
    downloadButton.setAttribute('data-download-url', file.url);
    downloadButton.onclick = () => downloadFile(file.url, file.name);
    downloadButtonCell.appendChild(downloadButton);
    listItem.appendChild(downloadButtonCell);

    return listItem;
}

// Datei herunterladen
function downloadFile(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Initiales Laden der Dateien bei DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadFiles);