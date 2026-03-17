import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstructorScenarios } from './instructor-scenarios';

describe('InstructorScenarios', () => {
  let component: InstructorScenarios;
  let fixture: ComponentFixture<InstructorScenarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructorScenarios],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorScenarios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
