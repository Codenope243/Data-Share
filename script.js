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

const MAX_CONCURRENT_UPLOADS = 3;
let currentUploads = 0;

let uploadType = "";
function toggleSwitch() {
    const switchBody = document.getElementById("switch");
    const fileInput = document.getElementById("fileInput");
    const folderInput = document.getElementById("folderInput");

    if (switchBody.style.marginLeft == "2px") {
        folderInput.style.display = 'none';
        fileInput.style.display = 'block';
        switchBody.style.marginLeft = "130px";
        uploadType = "file" 
    } else {
        fileInput.style.display = 'none';
        folderInput.style.display = 'block';
        switchBody.style.marginLeft = "2px";
        uploadType = "folder" 
    }
}



document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('folderInput').addEventListener('change', handleFileSelect);

function handleFileSelect(event) {
    const files = event.target.files;
    const uploadingFilesContainer = document.getElementById('uploading-files-container');

    // Entferne nur die Dateicontainer, nicht die Überschrift
    const existingContainers = uploadingFilesContainer.querySelectorAll('.file-container');
    existingContainers.forEach(container => container.remove());

    for (const file of files) {
        createFileContainer(file.name);
    }
}

document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    let files;
    if (uploadType === 'file') {
        files = document.getElementById('fileInput').files;
    } else {
        files = document.getElementById('folderInput').files;
    }

    if (uploadType === 'folder') {
        const zip = new JSZip();
        const firstFilePath = files[0].webkitRelativePath || files[0].name;
        const folderName = firstFilePath.split('/')[0];

        for (const file of files) {
            const filePath = file.webkitRelativePath || file.name;
            zip.file(filePath, file);
        }

        while (currentUploads >= MAX_CONCURRENT_UPLOADS) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms warten
        }

        currentUploads++;
        zip.generateAsync({ type: 'blob' }).then(async (content) => {
            const zipFile = new File([content], `${folderName}.zip`, { type: 'application/zip' });
            await uploadFile(zipFile);
            currentUploads--;
        }).catch((error) => {
            console.error('Fehler beim Komprimieren der Dateien:', error);
            currentUploads--;
        });
    } else {
        for (const file of files) {
            while (currentUploads >= MAX_CONCURRENT_UPLOADS) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms warten
            }

            currentUploads++;
            await uploadFile(file);
            currentUploads--;
        }
    }
});

async function uploadFile(file) {
    try {
        const fileSize = file.size;
        console.log(fileSize);

        const storageRef = storage.ref('uploads/' + file.name);
        const uploadTask = storageRef.put(file);

        const progressBarContainer = document.createElement('div');
        progressBarContainer.classList.add('progress-bar-container');
        const progressBar = document.createElement('div');
        progressBar.classList.add('progress');
        const cancelButton = document.createElement('button');
        cancelButton.classList.add('cancel-button');
        cancelButton.textContent = 'Abbrechen';
        progressBarContainer.appendChild(progressBar);
        progressBarContainer.appendChild(cancelButton);
        document.getElementById('progressContainer').appendChild(progressBarContainer);

        const onCancel = () => {
            uploadTask.cancel();
            progressBarContainer.remove();
        };
        cancelButton.addEventListener('click', onCancel);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressBar.style.width = progress + '%';
                progressBar.textContent = Math.floor(progress) + '%';

            }, 
            (error) => {
                console.error('Fehler beim Hochladen der Datei:', error);
            }, 
            async () => {
                const downloadURL = await storageRef.getDownloadURL();
                await db.collection('files').add({
                    name: file.name,
                    url: downloadURL,
                    size: file.size // Die Dateigröße wird hier hinzugefügt
                });

            const uploadeConfirmMessage = document.getElementById("confirme-message-container")
            const confirmeMessage = document.getElementById("confirme-message")
                confirmeMessage.innerHTML=file.name + " erfolgreich hochgeladen" 
                uploadeConfirmMessage.style.marginTop = "-52%"
                
                setTimeout(() => {
                    uploadeConfirmMessage.style.marginTop = "-100%";
                }, 2000); // 2000ms = 2s

                loadFiles();
                progressBarContainer.remove();
            }
        );
    } catch (error) {
        console.error('Fehler beim Hochladen der Datei:', error);
        alert(`Fehler beim Hochladen der Datei ${file.name}. Überprüfen Sie die Konsole für weitere Details.`);
    }
}

function createFileContainer(fileName) {
    const fileContainer = document.createElement('div');
    fileContainer.classList.add('file-container');
    
    const fileNameParagraph = document.createElement('p');
    fileNameParagraph.classList.add('fileName');
    fileNameParagraph.textContent = fileName;
    
    const removeButton = document.createElement('button');
    removeButton.classList.add('uploade-file-remove-button');
    removeButton.addEventListener('click', () => {
        fileContainer.remove();
    });
    
    fileContainer.appendChild(fileNameParagraph);
    fileContainer.appendChild(removeButton);
    document.getElementById('uploading-files-container').appendChild(fileContainer);
}


async function loadFiles() {
    try {
        const snapshot = await db.collection('files').get();
        const fileList = document.getElementById('fileList');

        snapshot.forEach(doc => {
            const file = doc.data();
            console.log(file); // Logge das File-Objekt zur Überprüfung
            const listItem = document.createElement('tr');

            // Name
            const fileNameCell = document.createElement('td');
            const fileNameText = document.createElement('p');
            fileNameText.textContent = file.name;
            fileNameCell.appendChild(fileNameText);
            listItem.appendChild(fileNameCell);

            // Größe
            const fileSizeCell = document.createElement('td');
            fileSizeCell.textContent = formatFileSize(file.size); // assuming file.size is available and in bytes
            listItem.appendChild(fileSizeCell);

            // Download-Button
            const downloadButtonCell = document.createElement('td');
            const downloadButton = document.createElement('button');
            downloadButton.classList.add('downloade-button');
            downloadButton.textContent = 'Download';
            downloadButton.setAttribute('data-download-url', file.url);
            downloadButton.onclick = function() {
                const url = downloadButton.getAttribute('data-download-url');
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
            downloadButtonCell.appendChild(downloadButton);
            listItem.appendChild(downloadButtonCell);

            fileList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Fehler beim Laden der Dateien:', error);
        alert('Fehler beim Laden der Dateien. Überprüfen Sie die Konsole für weitere Details.');
    }
}

function formatFileSize(bytes) {
    if (bytes === undefined || bytes === null) return 'Unbekannt';
    if (bytes < 1024) return bytes + ' B';
    let k = 1024,
        sizes = ['KB', 'MB', 'GB', 'TB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i - 1];
}

// Initiales Laden der Dateien
document.addEventListener('DOMContentLoaded', loadFiles);