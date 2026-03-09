import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstructorVideos } from './instructor-videos';

describe('InstructorVideos', () => {
  let component: InstructorVideos;
  let fixture: ComponentFixture<InstructorVideos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructorVideos],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorVideos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
