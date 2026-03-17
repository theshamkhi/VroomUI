import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstructorStudents } from './instructor-students';

describe('InstructorStudents', () => {
  let component: InstructorStudents;
  let fixture: ComponentFixture<InstructorStudents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructorStudents],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorStudents);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
