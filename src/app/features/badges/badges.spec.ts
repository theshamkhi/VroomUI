import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BadgesComponent } from './badges';

describe('BadgesComponent', () => {
  let component: BadgesComponent;
  let fixture: ComponentFixture<BadgesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BadgesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
