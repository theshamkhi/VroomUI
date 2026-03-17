import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstructorAnalytics } from './instructor-analytics';

describe('InstructorAnalytics', () => {
  let component: InstructorAnalytics;
  let fixture: ComponentFixture<InstructorAnalytics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstructorAnalytics],
    }).compileComponents();

    fixture = TestBed.createComponent(InstructorAnalytics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
