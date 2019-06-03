import {IInputs, IOutputs} from "./generated/ManifestTypes";

import * as FileSaver from 'file-saver';

class EntityReference {
    id: string;
    typeName: string;
    constructor(typeName: string, id: string) {
        this.id = id;
        this.typeName = typeName;
    }
}

class AttachedFile implements ComponentFramework.FileObject{
	fileContent: string;
	fileSize: number;
    fileName: string;
	mimeType: string;
    constructor(fileName: string, mimeType: string, fileContent: string,fileSize: number) {
        this.fileName = fileName;
		this.mimeType = mimeType;
		this.fileContent = fileContent;
		this.fileSize = fileSize;
    }
}

export class GalleryFieldControl implements ComponentFramework.StandardControl<IInputs, IOutputs> {

	private _context: ComponentFramework.Context<IInputs>;
	private _container: HTMLDivElement;
	private _mainDiv: HTMLDivElement;
	private _previewImage: HTMLImageElement;

	private _thumbnailClicked: EventListenerOrEventListenerObject;   
	private _clearPreviewImage: EventListenerOrEventListenerObject; 
	
	private supportedTypes:string[] = ["image/jpeg", "image/png","image/svg+xml"];

	constructor()
	{

	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='starndard', it will receive an empty div element within which it can render its content.
	 */
	public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container:HTMLDivElement)
	{
		// Add control initialization code
		this._context = context;
		this._container = container;

		this._thumbnailClicked = this.ThumbnailClicked.bind(this);
		this._clearPreviewImage = this.ClearPreviewImage.bind(this);

		var mainDiv = document.createElement("div");
		mainDiv.classList.add("carousel");

		this._mainDiv = mainDiv;

		this._container.appendChild(mainDiv);

		var previewImg = document.createElement("img");
		previewImg.classList.add("preview-img");
		previewImg.addEventListener("click", this._clearPreviewImage);

		this._previewImage = previewImg;

		this._container.appendChild(previewImg);

		
		let reference: EntityReference = new EntityReference(
			(<any>context).page.entityTypeName,
			(<any>context).page.entityId
		)

		this.GetAttachemnts(reference).then(result => this.RenderThumbnails(result));
	}


	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void
	{
		// Add code to update control view
	}

	/** 
	 * It is called by the framework prior to a control receiving new data. 
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
	public getOutputs(): IOutputs
	{
		return {};
	}

	/** 
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void
	{
		// Add code to cleanup control if necessary
	}

	private async GetAttachemnts(ref : EntityReference): Promise<AttachedFile[]>{
		var fetchXml =
		"<fetch>"+
		"  <entity name='annotation'>"+
		"    <filter>"+
		"      <condition attribute='isdocument' operator='eq' value='1'/>"+
		"      <condition attribute='objectid' operator='eq' value='"+ ref.id +"'/>"+
		"    </filter>"+
		"  </entity>"+
		"</fetch>";

		let query = '?fetchXml=' + encodeURIComponent(fetchXml); 

		try {
			const result = await this._context.webAPI.retrieveMultipleRecords("annotation", query);
			let items = [];
			for (let i = 0; i < result.entities.length; i++) {
				let record = result.entities[i];
				let fileName = (<string>record["filename"]);
				let mimeType = (<string>record["mimetype"]);
				let content = (<string>record["documentbody"]);
				let fileSize = (<number>record["filesize"]);
				let file = new AttachedFile(fileName, mimeType, content, fileSize);
				items.push(file);
			}
			return items;
		}
		catch (error) {
			return [];
		}
	}

	private RenderThumbnails(files:AttachedFile[]){		
		for (let index = 0; index < files.length; index++) {
			const file = files[index];
			
			if(!this.supportedTypes.includes(file.mimeType)){continue;}

			let itemContainer = document.createElement("div");
			itemContainer.classList.add("thumbnail-container");

			let thumbnailDiv = document.createElement("div");
			thumbnailDiv.classList.add("thumbnail");

			let imageDiv = document.createElement("img");
			imageDiv.src = 'data:' + file.mimeType + ';base64, ' + file.fileContent;
			imageDiv.addEventListener("click", this._thumbnailClicked);

			thumbnailDiv.appendChild(imageDiv);

			let fileNameDiv = document.createElement("div");
			fileNameDiv.classList.add("file-name");
			fileNameDiv.textContent = file.fileName;
			fileNameDiv.onclick = (e => { this.DownloadFile(file); });

			itemContainer.appendChild(thumbnailDiv);
			itemContainer.appendChild(fileNameDiv);

			this._mainDiv.appendChild(itemContainer);			
		}
	}

	private Base64ToFile(base64Data:string, tempfilename:string, contentType:string) {
		contentType = contentType || '';
		const sliceSize = 1024;
		const byteCharacters = atob(base64Data);
		const bytesLength = byteCharacters.length;
		const slicesCount = Math.ceil(bytesLength / sliceSize);
		const byteArrays = new Array(slicesCount);
	
		for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
		  const begin = sliceIndex * sliceSize;
		  const end = Math.min(begin + sliceSize, bytesLength);
	
		  const bytes = new Array(end - begin);
		  for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
			bytes[i] = byteCharacters[offset].charCodeAt(0);
		  }
		  byteArrays[sliceIndex] = new Uint8Array(bytes);
		}
		return new File(byteArrays, tempfilename, {type: contentType});
	  }

	private ThumbnailClicked(evt: Event): void {
		let base64 = (<HTMLImageElement>evt.srcElement).src;
		this._previewImage.src = base64;
	}

	private ClearPreviewImage(evt: Event): void {
		this._previewImage.src = "";
	}
	
	private DownloadFile(file: AttachedFile): void {
		const myFile = this.Base64ToFile(file.fileContent, file.fileName, file.mimeType);
		FileSaver.saveAs(myFile,file.fileName);
	}
}