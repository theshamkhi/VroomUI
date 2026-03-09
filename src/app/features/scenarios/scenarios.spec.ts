import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Scenarios } from './scenarios';

describe('Scenarios', () => {
  let component: Scenarios;
  let fixture: ComponentFixture<Scenarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Scenarios],
    }).compileComponents();

    fixture = TestBed.createComponent(Scenarios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
