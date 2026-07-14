import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { Brand, BrandPayload } from '../../../core/models/brand.model';
import { Category } from '../../../core/models/category.model';
import { BrandsService } from '../../../core/services/brands.service';
import { SingleImagePickerComponent } from '../../../shared/components/single-image-picker/single-image-picker.component';

@Component({selector:'app-add-edit-brand',standalone:true,changeDetection:ChangeDetectionStrategy.OnPush,imports:[CommonModule,ReactiveFormsModule,DialogModule,ButtonModule,InputTextModule,InputTextareaModule,InputNumberModule,MultiSelectModule,CheckboxModule,SingleImagePickerComponent],templateUrl:'./add-edit-brand.component.html',styleUrl:'./add-edit-brand.component.scss'})
export class AddEditBrandComponent implements OnChanges {
  private fb=inject(FormBuilder);private service=inject(BrandsService);private cdr=inject(ChangeDetectorRef);
  @Input() visible=false;@Input() brand:Brand|null=null;@Input() categories:Category[]=[];@Output() visibleChange=new EventEmitter<boolean>();@Output() saved=new EventEmitter<Brand>();
  protected saving=signal(false);protected submitted=signal(false);private nameChanged=false;
  protected form=this.fb.group({name:['',[Validators.required,Validators.maxLength(255)]],slug:['',[Validators.required,Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],logo:[''],description:['',Validators.maxLength(10000)],categoryIds:this.fb.control<string[]>([]),website:[''],sortOrder:[0],isFeatured:[false],isActive:[true],isVisible:[true],seoTitle:[''],seoDescription:[''],seoKeywords:[''],canonicalUrl:[''],ogImage:['']});
  ngOnChanges(){if(!this.visible)return;const b=this.brand;this.submitted.set(false);this.nameChanged=false;this.form.reset({name:b?.name||'',slug:b?.slug||'',logo:b?.logo||'',description:b?.description||'',categoryIds:b?.categoryIds||[],website:b?.website||'',sortOrder:b?.sortOrder||0,isFeatured:b?.isFeatured||false,isActive:b?.isActive??true,isVisible:b?.isVisible??true,seoTitle:b?.seoTitle||'',seoDescription:b?.seoDescription||'',seoKeywords:b?.seoKeywords?.join(', ')||'',canonicalUrl:b?.canonicalUrl||'',ogImage:b?.ogImage||''})}
  protected onName(value:string){if(!this.brand||!this.nameChanged)this.form.controls.slug.setValue(this.slugify(value));this.nameChanged=true} protected close(){this.visibleChange.emit(false)}
  protected async submit(){this.submitted.set(true);if(this.form.invalid){this.form.markAllAsTouched();return}this.saving.set(true);try{const v=this.form.getRawValue();const payload:BrandPayload={name:v.name!,slug:v.slug!,logo:v.logo||null,description:v.description||null,categoryIds:v.categoryIds||[],website:v.website||null,sortOrder:Number(v.sortOrder)||0,isFeatured:!!v.isFeatured,isActive:!!v.isActive,isVisible:!!v.isVisible,seoTitle:v.seoTitle||null,seoDescription:v.seoDescription||null,seoKeywords:(v.seoKeywords||'').split(',').map(x=>x.trim()).filter(Boolean),canonicalUrl:v.canonicalUrl||null,ogImage:v.ogImage||null};const item=this.brand?await this.service.updateBrand(this.brand._id,payload):await this.service.createBrand(payload);this.saved.emit(item);this.close()}finally{this.saving.set(false);this.cdr.markForCheck()}}
  private slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}
}
