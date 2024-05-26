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

document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const files = document.getElementById('fileInput').files;

    for (const file of files) {
        while (currentUploads >= MAX_CONCURRENT_UPLOADS) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms warten
        }

        currentUploads++;
        uploadFile(file).finally(() => currentUploads--);
    }
});

async function uploadFile(file) {
    try {
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
                alert(`Fehler beim Hochladen der Datei ${file.name}. Überprüfen Sie die Konsole für weitere Details.`);
            }, 
            async () => {
                const downloadURL = await storageRef.getDownloadURL();
                await db.collection('files').add({
                    name: file.name,
                    url: downloadURL,
                    size: file.size // Die Dateigröße wird hier hinzugefügt
                });

                alert(`Datei ${file.name} erfolgreich hochgeladen`);
                loadFiles();
                progressBarContainer.remove();
            }
        );
    } catch (error) {
        console.error('Fehler beim Hochladen der Datei:', error);
        alert(`Fehler beim Hochladen der Datei ${file.name}. Überprüfen Sie die Konsole für weitere Details.`);
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

async function loadFiles() {
    try {
        const snapshot = await db.collection('files').get();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        snapshot.forEach(doc => {
            const file = doc.data();
            console.log(file); // Logge das File-Objekt zur Überprüfung
            const listItem = document.createElement('tr');

            // Name
            const fileNameCell = document.createElement('td');
            const fileNameLink = document.createElement('a');
            fileNameLink.href = file.url;
            fileNameLink.textContent = file.name;
            fileNameLink.target = '_blank';
            fileNameCell.appendChild(fileNameLink);
            listItem.appendChild(fileNameCell);

            // Größe
            const fileSizeCell = document.createElement('td');
            fileSizeCell.textContent = formatFileSize(file.size); // assuming file.size is available and in bytes
            listItem.appendChild(fileSizeCell);

            // Download-Button
            const downloadButtonCell = document.createElement('td');
            const downloadButton = document.createElement('button');
            downloadButton.textContent = 'Download';
            downloadButton.onclick = function() {
                window.open(file.url, '_blank');
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

window.onload = loadFiles;



